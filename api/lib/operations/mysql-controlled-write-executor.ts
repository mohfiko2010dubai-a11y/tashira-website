import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection } from "mysql2/promise";
import { z } from "zod";
import type { OperationsWriteExecutor } from "../../operations-write-router";
import type { AuthorizationActor } from "../authorization/policy";
import { authorize } from "../authorization/policy";
import type { EvaluationEvidenceSnapshot } from "../eligibility/evaluation-evidence";
import type { EligibilityRule } from "../eligibility/eligibility-engine";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";
import { isOperationsFlagEnabled, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import { ruleClassificationSchema, ruleLayerSchema } from "../rules/rule-import";
import { MysqlOperationsAccessProvider, runtimeFlagEnvironment } from "./mysql-access-provider";
import { assignCase, recordHumanReview, requestReevaluation, reviewDocument, transitionCaseStatus } from "./controlled-actions";
import { CONTROLLED_STATUS_TRANSITIONS } from "./controlled-state-machine";
import { InMemoryControlledWriteRepository, type ApplicationStatus, type ControlledAuditEvent, type WriteResult } from "./controlled-write-repository";

type SqlValue = string | number | bigint | boolean | Date | null | Buffer | Uint8Array;
type Action = ControlledAuditEvent["action"];
type CommonInput = { applicationId: number; expectedVersion: number; idempotencyKey: string; reason: string };

const applicationStatusSchema = z.enum([
  "submitted", "payment_received", "documents_pending", "documents_received", "under_review",
  "visa_processing", "visa_received", "completed", "rejected", "cancelled",
] satisfies ApplicationStatus[]);
const evaluationStateSchema = z.enum(["ELIGIBLE", "INELIGIBLE", "HUMAN_REVIEW_REQUIRED", "RULE_CONFLICT"]);
const matchedRuleSchema = z.object({
  ruleId: z.string(), ruleVersion: z.number().int().positive(), layer: ruleLayerSchema,
  classification: ruleClassificationSchema, sourceAuthority: z.string(), reason: z.string(),
});
const conditionalDocumentSchema = z.object({
  code: z.string(), reason: z.string(),
  when: z.object({ questionCode: z.string(), operator: z.enum(["EQUALS", "IN"]), value: z.union([z.string(), z.array(z.string())]) }).optional(),
});

const conditionSchema = z.array(z.object({
  field: z.string().min(1).max(100),
  operator: z.enum(["EQUALS", "IN", "NOT_IN", "EXISTS"]),
  value: z.union([z.string(), z.array(z.string())]).optional(),
}));
const outcomeSchema = z.object({
  eligibility: z.enum(["NO_CHANGE", "ELIGIBLE", "INELIGIBLE", "HUMAN_REVIEW_REQUIRED"]),
  requirementCodes: z.array(z.string()),
  conditionalDocuments: z.array(z.object({ code: z.string(), reason: z.string() })).default([]),
  explanationCode: z.string(),
});

export type OperationsWriteErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "OUT_OF_SCOPE" | "NOT_FOUND"
  | "INVALID_STATE_TRANSITION" | "PRECONDITION_FAILED" | "CONCURRENCY_CONFLICT"
  | "IDEMPOTENCY_CONFLICT" | "FEATURE_DISABLED" | "PERSISTENCE_FAILURE";

export class OperationsWriteError extends Error {
  readonly code: OperationsWriteErrorCode;
  constructor(code: OperationsWriteErrorCode, cause?: unknown) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = "OperationsWriteError";
    this.code = code;
  }
}

export type OperationsWriteCapabilities = {
  applicationId: number;
  version: number;
  status: ApplicationStatus;
  currentActorId: string;
  assignedActorId: string | null;
  teamId: number | null;
  humanReview: boolean;
  documentReview: boolean;
  assignmentModes: readonly ("ASSIGN" | "CLAIM" | "REASSIGN")[];
  validStatusTransitions: readonly ApplicationStatus[];
  reevaluationApplicantIds: readonly number[];
  documents: readonly { documentId: number; applicantId: number; version: number }[];
  permittedAssignees: readonly { actorId: string; displayName: string }[];
};

export type MysqlControlledWriteHooks = {
  beforeAuditPersist?: (context: { action: Action; applicationId: number; idempotencyKey: string }) => void | Promise<void>;
};

async function rows(connection: PoolConnection, sql: string, parameters: readonly SqlValue[] = []): Promise<readonly object[]> {
  const [result] = await connection.execute(sql, [...parameters]);
  if (!Array.isArray(result)) return [];
  const values: object[] = [];
  for (const row of result) if (typeof row === "object" && row !== null) values.push(row);
  return values;
}

async function affected(connection: PoolConnection, sql: string, parameters: readonly SqlValue[] = []): Promise<number> {
  const [result] = await connection.execute(sql, [...parameters]);
  const value = typeof result === "object" && result !== null ? Reflect.get(result, "affectedRows") : null;
  return typeof value === "number" ? value : 0;
}

function field(row: object, name: string): unknown { return Reflect.get(row, name); }
function stringField(row: object, name: string): string | null {
  const value = field(row, name);
  return typeof value === "string" ? value : null;
}
function numberField(row: object, name: string): number | null {
  const value = field(row, name);
  const parsed = typeof value === "number" ? value : typeof value === "bigint" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(parsed) ? parsed : null;
}
function jsonField(row: object, name: string): unknown {
  const value = field(row, name);
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}
function dateField(row: object, name: string): Date | null {
  const value = field(row, name);
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed;
  }
  return null;
}

function hashCommand(action: Action, input: object): string {
  return createHash("sha256").update(JSON.stringify({ action, input })).digest("hex");
}

function mappedError(error: unknown): OperationsWriteError {
  if (error instanceof OperationsWriteError) return error;
  const message = error instanceof Error ? error.message : "";
  if (message === "OPERATIONS_WRITE_ACCESS_DENIED") return new OperationsWriteError("OUT_OF_SCOPE");
  if (message === "STALE_ENTITY_VERSION" || message === "STALE_DOCUMENT_VERSION" || message === "STALE_EVALUATION_SELECTION") return new OperationsWriteError("CONCURRENCY_CONFLICT");
  if (message === "IDEMPOTENCY_KEY_CONFLICT") return new OperationsWriteError("IDEMPOTENCY_CONFLICT");
  if (message === "INVALID_STATUS_TRANSITION") return new OperationsWriteError("INVALID_STATE_TRANSITION");
  if (message === "CONTROLLED_CASE_NOT_FOUND") return new OperationsWriteError("NOT_FOUND");
  if (message === "OPERATIONS_CONTROLLED_WRITES_DISABLED") return new OperationsWriteError("FEATURE_DISABLED");
  if (/^(AUTHENTICATED_ACTOR_REQUIRED|ACTOR_REQUIRED)$/.test(message)) return new OperationsWriteError("UNAUTHENTICATED");
  if (/^(HUMAN_REVIEW_PREREQUISITE_FAILED|DOCUMENT_REVIEW_PREREQUISITE_FAILED|APPLICANT_OWNERSHIP_MISMATCH|DOCUMENT_OWNERSHIP_MISMATCH|TERMINAL_CASE_IS_READ_ONLY|ASSIGNEE_|CASE_|ASSIGNMENT_|CLAIM_|ACTION_REASON_REQUIRED|INVALID_)/.test(message)) return new OperationsWriteError("PRECONDITION_FAILED");
  return new OperationsWriteError("PERSISTENCE_FAILURE", error);
}

type LockedCase = {
  repository: InMemoryControlledWriteRepository;
  referenceNumber: string;
  departmentId?: number;
};

export class MysqlControlledWriteExecutor implements OperationsWriteExecutor {
  private readonly pool: Pool;
  private readonly access: MysqlOperationsAccessProvider;
  private readonly hooks: MysqlControlledWriteHooks;

  constructor(pool: Pool, access: MysqlOperationsAccessProvider, hooks: MysqlControlledWriteHooks = {}) {
    this.pool = pool;
    this.access = access;
    this.hooks = hooks;
  }

  async capabilities(applicationId: number, actor: AuthorizationActor): Promise<OperationsWriteCapabilities> {
    const trustedActor = await this.access.refreshTrustedActor(actor.id);
    const flags = await this.access.featureFlags();
    if (!isOperationsFlagEnabled("OPERATIONS_CONTROLLED_WRITES", this.flagContext(trustedActor), flags)) throw new OperationsWriteError("FEATURE_DISABLED");
    const connection = await this.pool.getConnection();
    try {
      // Migration 020 permits additive lazy initialization for legacy and
      // customer-created applications. This row carries concurrency state only;
      // it does not assign staff, change status, or mutate financial values.
      await affected(connection,
        "INSERT IGNORE INTO operations_case_controls (application_id,version) SELECT id,0 FROM applications WHERE id=?",
        [applicationId]);
      const cases = await rows(connection,
        `SELECT c.version,c.assigned_staff_user_id AS assignedStaffId,c.team_id AS teamId,t.department_id AS departmentId,a.status
           FROM operations_case_controls c JOIN applications a ON a.id=c.application_id
           LEFT JOIN operations_teams t ON t.id=c.team_id WHERE c.application_id=?`, [applicationId]);
      const value = cases[0];
      const version=value?numberField(value,"version"):null, status=applicationStatusSchema.safeParse(value?stringField(value,"status"):null);
      if (!value || version===null || !status.success) throw new OperationsWriteError("NOT_FOUND");
      const assignedStaffId=numberField(value,"assignedStaffId"), teamId=numberField(value,"teamId"), departmentId=numberField(value,"departmentId");
      const resource={assignedActorId:assignedStaffId===null?undefined:`staff:${assignedStaffId}`,teamId:teamId??undefined,departmentId:departmentId??undefined};
      const canRead=authorize(trustedActor,trustedActor.permissions.has("case.read")?"case.read":"case.read_assigned",resource).allowed;
      if(!canRead) throw new OperationsWriteError("OUT_OF_SCOPE");
      const can=(permission: Parameters<typeof authorize>[1])=>authorize(trustedActor,permission,resource).allowed;
      const terminal=["completed","rejected","cancelled"].includes(status.data);
      const documents=await rows(connection,
        `SELECT d.id AS documentId,d.applicant_id AS applicantId,COALESCE(dc.version,0) AS version
           FROM documents d LEFT JOIN operations_document_controls dc ON dc.document_id=d.id WHERE d.application_id=?`,[applicationId]);
      const applicants=await rows(connection,
        `SELECT a.id AS applicantId, EXISTS(SELECT 1 FROM visa_rule_evaluation_selections s WHERE s.application_id=a.application_id AND s.applicant_id=a.id) AS evaluated
           FROM applicants a WHERE a.application_id=?`,[applicationId]);
      const assignmentModes:("ASSIGN"|"CLAIM"|"REASSIGN")[]=[];
      if(!terminal && can("case.assign")) assignmentModes.push(assignedStaffId===null?"ASSIGN":"REASSIGN");
      if(!terminal && assignedStaffId===null && can("case.read_assigned") && trustedActor.id!=="admin") assignmentModes.push("CLAIM");
      const assignees=teamId===null||!can("case.assign")?[]:await rows(connection,
        `SELECT DISTINCT s.id,s.name FROM staff_users s
           JOIN operations_scope_grants sg ON sg.staff_user_id=s.id AND sg.team_id=? AND sg.revoked_at IS NULL
           JOIN operations_staff_workload_limits wl ON wl.staff_user_id=s.id
          WHERE s.is_active='active' AND (SELECT COUNT(*) FROM operations_case_controls c WHERE c.assigned_staff_user_id=s.id)<wl.workload_limit
          ORDER BY s.name,s.id`,[teamId]);
      return {
        applicationId,version,status:status.data,currentActorId:trustedActor.id,
        assignedActorId:assignedStaffId===null?null:`staff:${assignedStaffId}`,teamId,
        humanReview:can("case.transition")&&["documents_received","under_review"].includes(status.data),
        documentReview:can("document.review")&&["documents_pending","documents_received","under_review"].includes(status.data),
        assignmentModes,
        validStatusTransitions:can("case.transition")?CONTROLLED_STATUS_TRANSITIONS[status.data]:[],
        reevaluationApplicantIds:can("rule.review")?applicants.flatMap((row)=>{const applicantId=numberField(row,"applicantId");return numberField(row,"evaluated")===1&&applicantId!==null?[applicantId]:[]}):[],
        documents:documents.flatMap((row)=>{const documentId=numberField(row,"documentId"),applicantId=numberField(row,"applicantId"),documentVersion=numberField(row,"version");return documentId===null||applicantId===null||documentVersion===null?[]:[{documentId,applicantId,version:documentVersion}]}),
        permittedAssignees:assignees.flatMap((row)=>{const id=numberField(row,"id"),name=stringField(row,"name");return id===null||!name?[]:[{actorId:`staff:${id}`,displayName:name}]}),
      };
    } catch(error) {
      throw mappedError(error);
    } finally { connection.release(); }
  }

  humanReview(input: Parameters<OperationsWriteExecutor["humanReview"]>[0], actor: AuthorizationActor): Promise<WriteResult> {
    return this.execute("HUMAN_REVIEW", input, actor, async ({ repository, trustedActor, flags, now }) =>
      recordHumanReview({ ...input, actor: trustedActor, context: this.flagContext(trustedActor), flags, repository }, { now: () => now, newId: randomUUID }));
  }

  documentReview(input: Parameters<OperationsWriteExecutor["documentReview"]>[0], actor: AuthorizationActor): Promise<WriteResult> {
    return this.execute("DOCUMENT_REVIEW", input, actor, async ({ repository, trustedActor, flags, now }) =>
      reviewDocument({ ...input, actor: trustedActor, context: this.flagContext(trustedActor), flags, repository }, { now: () => now, newId: randomUUID }));
  }

  assignment(input: Parameters<OperationsWriteExecutor["assignment"]>[0], actor: AuthorizationActor): Promise<WriteResult> {
    return this.execute(input.mode, input, actor, async ({ connection, repository, trustedActor, flags, now }) => {
      const assigneeId = this.staffId(input.assigneeId);
      const assigneeRows = await rows(connection,
        `SELECT s.is_active AS active, wl.workload_limit AS workloadLimit
           FROM staff_users s LEFT JOIN operations_staff_workload_limits wl ON wl.staff_user_id=s.id
          WHERE s.id=? FOR UPDATE`, [assigneeId]);
      const assignee = assigneeRows[0];
      const workloadLimit = assignee ? numberField(assignee, "workloadLimit") : null;
      if (!assignee || stringField(assignee, "active") !== "active" || workloadLimit === null) throw new Error("ASSIGNEE_CONFIGURATION_REQUIRED");
      const scopes = await rows(connection, "SELECT team_id AS teamId FROM operations_scope_grants WHERE staff_user_id=? AND revoked_at IS NULL AND team_id IS NOT NULL", [assigneeId]);
      const teamIds = new Set(scopes.map((row) => numberField(row, "teamId")).filter((id): id is number => id !== null));
      const workloadRows = await rows(connection, "SELECT COUNT(*) AS count FROM operations_case_controls WHERE assigned_staff_user_id=?", [assigneeId]);
      repository.seedWorkload(input.assigneeId, numberField(workloadRows[0] ?? {}, "count") ?? 0);
      return assignCase({ ...input, actor: trustedActor, context: this.flagContext(trustedActor), flags, repository,
        assignee: { id: input.assigneeId, active: true, teamIds, workloadLimit } }, { now: () => now, newId: randomUUID });
    });
  }

  statusTransition(input: Parameters<OperationsWriteExecutor["statusTransition"]>[0], actor: AuthorizationActor): Promise<WriteResult> {
    return this.execute("STATUS_TRANSITION", input, actor, async ({ repository, trustedActor, flags, now }) =>
      transitionCaseStatus({ ...input, actor: trustedActor, context: this.flagContext(trustedActor), flags, repository }, { now: () => now, newId: randomUUID }));
  }

  requestReevaluation(input: Parameters<OperationsWriteExecutor["requestReevaluation"]>[0], actor: AuthorizationActor): Promise<WriteResult> {
    return this.execute("REEVALUATION_REQUEST", input, actor, async ({ connection, repository, trustedActor, flags, now }) => {
      if (!isOperationsFlagEnabled("VISA_RULES_EVALUATION", this.flagContext(trustedActor), flags)) throw new OperationsWriteError("FEATURE_DISABLED");
      const current = await this.loadCurrentSnapshot(connection, input.applicationId, input.applicantId);
      const profileRows = await rows(connection,
        `SELECT a.nationality, app.visa_type AS routeCode,
                app.base_type AS baseType, app.residence_type AS residenceType
           FROM applicants a JOIN applications app ON app.id=a.application_id
          WHERE a.id=? AND a.application_id=?`, [input.applicantId, input.applicationId]);
      const profile = profileRows[0];
      if (!profile || current.evaluationId !== input.expectedCurrentEvaluationId) throw new Error("STALE_EVALUATION_SELECTION");
      const routeCode = stringField(profile, "routeCode");
      if (!routeCode) throw new Error("REEVALUATION_PROFILE_UNAVAILABLE");
      const { rules, versionIds } = await this.loadActiveRules(connection, routeCode);
      const snapshots = new InMemoryEligibilitySnapshotRepository();
      snapshots.append(current);
      snapshots.select({ id: `loaded-${current.evaluationId}`, applicationId: input.applicationId, applicantId: input.applicantId,
        evaluationId: current.evaluationId, reason: "Loaded current immutable selection", selectedBy: "system", selectedAt: current.evaluatedAt });
      const result = requestReevaluation({ ...input, actor: trustedActor, context: this.flagContext(trustedActor), flags, repository, snapshots,
        selectedRoute: routeCode,
        profile: { routeCode, attributes: {
          nationality: stringField(profile, "nationality") ?? undefined,
          baseType: stringField(profile, "baseType") ?? undefined,
          residenceType: stringField(profile, "residenceType") ?? undefined,
        } }, rules }, { now: () => now, newId: randomUUID });
      const next = snapshots.current(input.applicationId, input.applicantId);
      if (!next || next.evaluationId === current.evaluationId) throw new Error("REEVALUATION_RESULT_UNAVAILABLE");
      await this.persistSnapshot(connection, next, versionIds, trustedActor.id);
      return result;
    });
  }

  private async execute(
    action: Action,
    input: CommonInput,
    actor: AuthorizationActor,
    domain: (context: { connection: PoolConnection; repository: InMemoryControlledWriteRepository; trustedActor: AuthorizationActor; flags: readonly FeatureFlagRecord[]; now: Date; locked: LockedCase }) => Promise<WriteResult>,
  ): Promise<WriteResult> {
    const connection = await this.pool.getConnection();
    try {
      const trustedActor = await this.access.refreshTrustedActor(actor.id);
      const flags = await this.access.featureFlags();
      if (!isOperationsFlagEnabled("OPERATIONS_CONTROLLED_WRITES", this.flagContext(trustedActor), flags)) throw new OperationsWriteError("FEATURE_DISABLED");
      await connection.beginTransaction();
      const commandHash = hashCommand(action, input);
      const replay = await rows(connection, "SELECT command_hash AS commandHash, result_json AS resultJson FROM operations_idempotency_records WHERE application_id=? AND idempotency_key=?", [input.applicationId, input.idempotencyKey]);
      if (replay[0]) {
        if (stringField(replay[0], "commandHash") !== commandHash) throw new OperationsWriteError("IDEMPOTENCY_CONFLICT");
        const parsed = jsonField(replay[0], "resultJson");
        if (!parsed || typeof parsed !== "object") throw new OperationsWriteError("PERSISTENCE_FAILURE");
        const result = this.parseResult(parsed);
        await connection.commit();
        return { ...result, status: "IDEMPOTENT_REPLAY" };
      }
      const locked = await this.lockCase(connection, input.applicationId);
      const committedWhileWaiting = await rows(connection, "SELECT command_hash AS commandHash, result_json AS resultJson FROM operations_idempotency_records WHERE application_id=? AND idempotency_key=? FOR UPDATE", [input.applicationId, input.idempotencyKey]);
      if (committedWhileWaiting[0]) {
        if (stringField(committedWhileWaiting[0], "commandHash") !== commandHash) throw new OperationsWriteError("IDEMPOTENCY_CONFLICT");
        const parsed = jsonField(committedWhileWaiting[0], "resultJson");
        if (!parsed || typeof parsed !== "object") throw new OperationsWriteError("PERSISTENCE_FAILURE");
        const result = this.parseResult(parsed);
        await connection.commit();
        return { ...result, status: "IDEMPOTENT_REPLAY" };
      }
      const before = locked.repository.get(input.applicationId);
      if (!before) throw new OperationsWriteError("NOT_FOUND");
      const now = new Date();
      const result = await domain({ connection, repository: locked.repository, trustedActor, flags, now, locked });
      const after = locked.repository.get(input.applicationId);
      const event = locked.repository.audit(input.applicationId)[0];
      if (!after || !event) throw new OperationsWriteError("PERSISTENCE_FAILURE");
      if (result.version !== input.expectedVersion + 1) throw new OperationsWriteError("CONCURRENCY_CONFLICT");
      await this.persistMutation(connection, action, input, before, after, event);
      await affected(connection,
        "INSERT INTO operations_idempotency_records (application_id,idempotency_key,command_hash,action_event_id,result_json) VALUES (?,?,?,?,?)",
        [input.applicationId, input.idempotencyKey, commandHash, event.id, JSON.stringify(result)]);
      await connection.commit();
      return result;
    } catch (error) {
      try { await connection.rollback(); } catch { /* preserve sanitized original */ }
      throw mappedError(error);
    } finally {
      connection.release();
    }
  }

  private flagContext(actor: AuthorizationActor) {
    const staff = /^staff:([1-9]\d*)$/.exec(actor.id);
    return { environment: runtimeFlagEnvironment(), staffId: staff ? Number(staff[1]) : undefined, teamIds: actor.teamIds };
  }

  private staffId(reference: string): number {
    const match = /^staff:([1-9]\d*)$/.exec(reference);
    if (!match) throw new Error("ASSIGNEE_ID_INVALID");
    const id = Number(match[1]);
    if (!Number.isSafeInteger(id)) throw new Error("ASSIGNEE_ID_INVALID");
    return id;
  }

  private async lockCase(connection: PoolConnection, applicationId: number): Promise<LockedCase> {
    await affected(connection, "INSERT IGNORE INTO operations_case_controls (application_id,version) SELECT id,0 FROM applications WHERE id=?", [applicationId]);
    const cases = await rows(connection,
      `SELECT c.version, c.assigned_staff_user_id AS assignedStaffId, c.team_id AS teamId,
              t.department_id AS departmentId, a.status, a.reference_number AS referenceNumber
         FROM operations_case_controls c JOIN applications a ON a.id=c.application_id
         LEFT JOIN operations_teams t ON t.id=c.team_id WHERE c.application_id=? FOR UPDATE`, [applicationId]);
    const value = cases[0];
    const version = value ? numberField(value, "version") : null;
    const status = value ? stringField(value, "status") : null;
    const referenceNumber = value ? stringField(value, "referenceNumber") : null;
    const parsedStatus = applicationStatusSchema.safeParse(status);
    if (version === null || !parsedStatus.success || !referenceNumber) throw new OperationsWriteError("NOT_FOUND");
    const applicantRows = await rows(connection, "SELECT id FROM applicants WHERE application_id=?", [applicationId]);
    const documentRows = await rows(connection,
      `SELECT d.id, d.applicant_id AS applicantId, COALESCE(dc.version,0) AS version
         FROM documents d LEFT JOIN operations_document_controls dc ON dc.document_id=d.id
        WHERE d.application_id=? FOR UPDATE`, [applicationId]);
    for (const document of documentRows) {
      const id = numberField(document, "id");
      if (id !== null) await affected(connection, "INSERT IGNORE INTO operations_document_controls (document_id,version) VALUES (?,0)", [id]);
    }
    const repository = new InMemoryControlledWriteRepository();
    const assignedStaffId = numberField(value, "assignedStaffId");
    const teamId = numberField(value, "teamId");
    const departmentId = numberField(value, "departmentId");
    repository.seed({ applicationId, version, status: parsedStatus.data,
      assignedActorId: assignedStaffId === null ? undefined : `staff:${assignedStaffId}`,
      teamId: teamId ?? undefined, departmentId: departmentId ?? undefined,
      applicantIds: applicantRows.map((row) => numberField(row, "id")).filter((id): id is number => id !== null),
      documents: documentRows.flatMap((row) => {
        const documentId = numberField(row, "id"); const applicantId = numberField(row, "applicantId"); const documentVersion = numberField(row, "version");
        return documentId === null || applicantId === null || documentVersion === null ? [] : [{ documentId, applicantId, version: documentVersion }];
      }), finance: {} });
    return { repository, referenceNumber, departmentId: departmentId ?? undefined };
  }

  private async persistMutation(connection: PoolConnection, action: Action, input: CommonInput,
    before: NonNullable<ReturnType<InMemoryControlledWriteRepository["get"]>>,
    after: NonNullable<ReturnType<InMemoryControlledWriteRepository["get"]>>, event: ControlledAuditEvent): Promise<void> {
    const assignedId = after.assignedActorId ? this.staffId(after.assignedActorId) : null;
    const advanced = await affected(connection,
      "UPDATE operations_case_controls SET version=?, assigned_staff_user_id=? WHERE application_id=? AND version=?",
      [after.version, assignedId, input.applicationId, before.version]);
    if (advanced !== 1) throw new OperationsWriteError("CONCURRENCY_CONFLICT");
    if (action === "STATUS_TRANSITION") {
      const changed = await affected(connection, "UPDATE applications SET status=? WHERE id=? AND status=?", [after.status, input.applicationId, before.status]);
      if (changed !== 1) throw new OperationsWriteError("CONCURRENCY_CONFLICT");
    }
    if (action === "DOCUMENT_REVIEW") {
      const documentId = numberField(event.details, "documentId");
      const version = numberField(event.details, "documentVersion");
      if (documentId === null || version === null || await affected(connection,
        "UPDATE operations_document_controls SET version=version+1 WHERE document_id=? AND version=?", [documentId, version]) !== 1) throw new OperationsWriteError("CONCURRENCY_CONFLICT");
    }
    await affected(connection,
      `INSERT INTO operations_action_events
       (id,application_id,action_type,actor_reference,applicant_id,document_id,document_version,outcome,from_state,to_state,previous_assignee_reference,new_assignee_reference,team_id,previous_evaluation_id,new_evaluation_id,reason,entity_version_before,entity_version_after,correlation_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [event.id, event.applicationId, event.action, event.actorId,
        numberField(event.details, "applicantId"), numberField(event.details, "documentId"), numberField(event.details, "documentVersion"),
        stringField(event.details, "outcome"), stringField(event.details, "from"), stringField(event.details, "to"),
        stringField(event.details, "previousAssigneeId"), stringField(event.details, "assigneeId"),
        after.teamId ?? null,
        stringField(event.details, "previousEvaluationId"), stringField(event.details, "evaluationId"), event.reason,
        event.entityVersionBefore, event.entityVersionAfter, input.idempotencyKey]);
    await this.hooks.beforeAuditPersist?.({ action, applicationId: input.applicationId, idempotencyKey: input.idempotencyKey });
    await affected(connection,
      `INSERT INTO operations_audit_events
       (id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome,reason_code,metadata_json)
       VALUES (?,?,?,?,'APPLICATION',?,'SUCCESS',?,?)`,
      [randomUUID(), `OPERATIONS_${event.action}`, event.actorId === "admin" ? "ADMIN" : "STAFF", event.actorId,
        String(event.applicationId), event.action, JSON.stringify({ actionEventId: event.id, entityVersion: event.entityVersionAfter })]);
  }

  private parseResult(value: object): WriteResult {
    const status = stringField(value, "status"); const applicationId = numberField(value, "applicationId");
    const version = numberField(value, "version"); const auditEventId = stringField(value, "auditEventId");
    if ((status !== "APPLIED" && status !== "IDEMPOTENT_REPLAY") || applicationId === null || version === null || !auditEventId) throw new OperationsWriteError("PERSISTENCE_FAILURE");
    return { status, applicationId, version, auditEventId };
  }

  private async loadCurrentSnapshot(connection: PoolConnection, applicationId: number, applicantId: number): Promise<EvaluationEvidenceSnapshot> {
    const runs = await rows(connection,
      `SELECT r.* FROM visa_rule_evaluation_selections s JOIN visa_rule_evaluation_runs r ON r.id=s.evaluation_id
        WHERE s.application_id=? AND s.applicant_id=? ORDER BY s.selected_at DESC,s.id DESC LIMIT 1 FOR UPDATE`, [applicationId, applicantId]);
    const run = runs[0];
    if (!run) throw new Error("STALE_EVALUATION_SELECTION");
    const matches = await rows(connection, "SELECT * FROM visa_rule_evaluation_matches WHERE evaluation_id=? ORDER BY sequence_number", [stringField(run, "id") ?? ""]);
    const matchedRules = matches.flatMap((row) => {
      const ruleId=stringField(row,"stable_rule_id"), ruleVersion=numberField(row,"rule_version_number"), layer=stringField(row,"rule_layer"), classification=stringField(row,"classification"), sourceAuthority=stringField(row,"source_authority"), reason=stringField(row,"match_reason");
      const parsed = matchedRuleSchema.safeParse({ ruleId, ruleVersion, layer, classification, sourceAuthority, reason });
      return parsed.success ? [parsed.data] : [];
    });
    const evaluationId=stringField(run,"id"), route=stringField(run,"route_code"), evaluated=dateField(run,"evaluated_at"), state=stringField(run,"final_eligibility_state"), reason=stringField(run,"decision_reason"), hash=stringField(run,"evidence_sha256");
    const parsedState = evaluationStateSchema.safeParse(state);
    const requiredDocuments = z.array(z.string()).safeParse(jsonField(run,"required_documents_json"));
    const conditionalDocuments = z.array(conditionalDocumentSchema).safeParse(jsonField(run,"conditional_documents_json"));
    const warnings = z.array(z.string()).safeParse(jsonField(run,"warnings_json"));
    if (!evaluationId || !route || !evaluated || !parsedState.success || !reason || !hash || !requiredDocuments.success || !conditionalDocuments.success || !warnings.success) throw new OperationsWriteError("PERSISTENCE_FAILURE");
    return { evaluationId, applicationId, applicantId, engineVersion: "eligibility-v1", selectedRoute: route, evaluatedAt: evaluated.toISOString(), eligibilityState: parsedState.data, reason,
      reevaluationReason:stringField(run,"reevaluation_reason"), supersedesEvaluationId:stringField(run,"supersedes_evaluation_id"), manualReviewReason:stringField(run,"manual_review_reason"),
      matchedRuleIds:matchedRules.map((item)=>item.ruleId), matchedRuleVersions:matchedRules.map((item)=>({ruleId:item.ruleId,version:item.ruleVersion})), sourceAuthorities:[...new Set(matchedRules.map((item)=>item.sourceAuthority))], matchedRules,
      requiredDocuments:requiredDocuments.data, conditionalDocuments:conditionalDocuments.data, warnings:warnings.data, precedenceTrace:matchedRules, evidenceSha256:hash, evidenceIntegrityReference:`sha256:${hash}` };
  }

  private async loadActiveRules(connection: PoolConnection, routeCode: string): Promise<{ rules: EligibilityRule[]; versionIds: Map<string,string> }> {
    const records = await rows(connection,
      `SELECT v.id AS versionId,v.version,v.classification,v.rule_layer AS ruleLayer,v.effective_from AS effectiveFrom,v.effective_to AS effectiveTo,
              v.conditions_json AS conditionsJson,v.outcome_json AS outcomeJson,rs.stable_id AS stableId,rs.route_code AS routeCode,s.authority
         FROM visa_rule_versions v JOIN visa_rule_sets rs ON rs.id=v.rule_set_id
         JOIN visa_rule_source_snapshots ss ON ss.id=v.source_snapshot_id JOIN visa_rule_sources s ON s.id=ss.source_id
        WHERE v.status='ACTIVE' AND v.rule_layer IS NOT NULL AND rs.route_code=?`, [routeCode]);
    const versionIds = new Map<string,string>(); const rules: EligibilityRule[]=[];
    for (const row of records) {
      const versionId=stringField(row,"versionId"), stableId=stringField(row,"stableId"), version=numberField(row,"version"), layer=ruleLayerSchema.safeParse(stringField(row,"ruleLayer")), classification=ruleClassificationSchema.safeParse(stringField(row,"classification")), authority=stringField(row,"authority"), effectiveFrom=dateField(row,"effectiveFrom"), effectiveTo=field(row,"effectiveTo")===null?null:dateField(row,"effectiveTo");
      const conditions=conditionSchema.safeParse(jsonField(row,"conditionsJson")); const outcome=outcomeSchema.safeParse(jsonField(row,"outcomeJson"));
      if (!versionId || !stableId || version===null || !layer.success || !classification.success || !authority || !effectiveFrom || !conditions.success || !outcome.success) throw new Error("ACTIVE_RULE_EVIDENCE_INVALID");
      const key=`${stableId}\u0000${version}`; versionIds.set(key,versionId);
      rules.push({id:stableId,version,routeCode,layer:layer.data,classification:classification.data,sourceAuthority:authority,reason:outcome.data.explanationCode,effectiveFrom,effectiveTo,
        conditions:conditions.data,eligibilityEffect:outcome.data.eligibility,requiredDocuments:outcome.data.requirementCodes,conditionalDocuments:outcome.data.conditionalDocuments});
    }
    return {rules,versionIds};
  }

  private async persistSnapshot(connection: PoolConnection, snapshot: EvaluationEvidenceSnapshot, versionIds: Map<string,string>, actorId: string): Promise<void> {
    await affected(connection,
      `INSERT INTO visa_rule_evaluation_runs
       (id,application_id,applicant_id,route_code,engine_version,final_eligibility_state,decision_reason,manual_review_reason,reevaluation_reason,required_documents_json,conditional_documents_json,warnings_json,precedence_trace_json,supersedes_evaluation_id,evidence_sha256,evaluated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [snapshot.evaluationId,snapshot.applicationId,snapshot.applicantId,snapshot.selectedRoute,snapshot.engineVersion,snapshot.eligibilityState,snapshot.reason,snapshot.manualReviewReason,snapshot.reevaluationReason,JSON.stringify(snapshot.requiredDocuments),JSON.stringify(snapshot.conditionalDocuments),JSON.stringify(snapshot.warnings),JSON.stringify(snapshot.precedenceTrace),snapshot.supersedesEvaluationId,snapshot.evidenceSha256,new Date(snapshot.evaluatedAt)]);
    for (const [index, match] of snapshot.matchedRules.entries()) {
      const versionId=versionIds.get(`${match.ruleId}\u0000${match.ruleVersion}`); if(!versionId) throw new Error("MATCHED_RULE_VERSION_UNAVAILABLE");
      await affected(connection,
        `INSERT INTO visa_rule_evaluation_matches (evaluation_id,sequence_number,rule_version_id,stable_rule_id,rule_version_number,rule_layer,classification,source_authority,match_reason) VALUES (?,?,?,?,?,?,?,?,?)`,
        [snapshot.evaluationId,index+1,versionId,match.ruleId,match.ruleVersion,match.layer,match.classification,match.sourceAuthority,match.reason]);
    }
    await affected(connection,
      "INSERT INTO visa_rule_evaluation_selections (id,application_id,applicant_id,evaluation_id,selection_reason,selected_by,selected_at) VALUES (?,?,?,?,?,?,?)",
      [randomUUID(),snapshot.applicationId,snapshot.applicantId,snapshot.evaluationId,snapshot.reevaluationReason ?? "Authorized re-evaluation",actorId,new Date(snapshot.evaluatedAt)]);
  }
}
