import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection } from "mysql2/promise";
import type { AuthorizationActor } from "../authorization/policy";
import { authorize } from "../authorization/policy";
import { isOperationsFlagEnabled } from "../feature-flags/feature-flags";
import { MysqlOperationsAccessProvider, runtimeFlagEnvironment } from "../operations/mysql-access-provider";
import { appendSchedulerAlertEvent, schedulerAlertKey, type SchedulerAlertEvent, type SchedulerAlertSeverity,
  type SchedulerAlertState, type SchedulerAlertType, type SchedulerQueueCategory } from "./scheduler-runtime";

type SqlValue = string | number | bigint | boolean | Date | null | Buffer | Uint8Array;
type AlertCommand = {
  applicationId: number; applicantId?: number | null; travelGroupId: string; scheduleEvaluationId: string;
  type: SchedulerAlertType; severity: SchedulerAlertSeverity; category: SchedulerQueueCategory;
  expectedVersion: number; idempotencyKey: string; correlationId: string; reason: string;
  context?: Readonly<Record<string, string | number | boolean | null>>;
};

export class SchedulerAlertPersistenceError extends Error {
  constructor(readonly code: "FEATURE_DISABLED" | "FORBIDDEN" | "NOT_FOUND" | "CONCURRENCY_CONFLICT" | "IDEMPOTENCY_CONFLICT" | "INVALID_TRANSITION" | "PERSISTENCE_FAILURE") {
    super(code); this.name = "SchedulerAlertPersistenceError";
  }
}

async function rows(connection: PoolConnection, sql: string, parameters: readonly SqlValue[] = []): Promise<readonly object[]> {
  const [result] = await connection.execute(sql, [...parameters]);
  if (!Array.isArray(result)) return [];
  const values: object[] = [];
  for (const row of result) if (typeof row === "object" && row !== null) values.push(row);
  return values;
}
function value(row: object, key: string): unknown { return Reflect.get(row, key); }
function text(row: object, key: string): string | null { const item = value(row, key); return typeof item === "string" ? item : null; }
function integer(row: object, key: string): number | null {
  const item = value(row, key); if (item === null || item === undefined) return null;
  const parsed = Number(item); return Number.isSafeInteger(parsed) ? parsed : null;
}
function date(row: object, key: string): string | null { const item = value(row, key); return item instanceof Date ? item.toISOString() : typeof item === "string" ? new Date(item).toISOString() : null; }
function hash(value: object): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export class MysqlSchedulerAlertProvider {
  constructor(private readonly pool: Pool, private readonly access: MysqlOperationsAccessProvider) {}

  create(input: Omit<AlertCommand, "expectedVersion">, actor: AuthorizationActor): Promise<SchedulerAlertEvent> {
    return this.execute({ ...input, expectedVersion: 0 }, "CREATED", actor);
  }
  acknowledge(input: AlertCommand, actor: AuthorizationActor): Promise<SchedulerAlertEvent> { return this.execute(input, "ACKNOWLEDGED", actor); }
  resolve(input: AlertCommand, actor: AuthorizationActor): Promise<SchedulerAlertEvent> { return this.execute(input, "RESOLVED", actor); }

  async listForApplication(applicationId: number, actor: AuthorizationActor): Promise<readonly SchedulerAlertEvent[]> {
    const trusted = await this.authorize(actor, applicationId);
    const connection = await this.pool.getConnection();
    try {
      const result = await rows(connection, `SELECT e.* FROM submission_scheduler_alert_events e
        JOIN (SELECT alert_key,MAX(version) version FROM submission_scheduler_alert_events WHERE application_id=? GROUP BY alert_key) current
          ON current.alert_key=e.alert_key AND current.version=e.version
        WHERE e.application_id=? ORDER BY e.occurred_at DESC,e.id DESC`, [applicationId, applicationId]);
      void trusted;
      return result.map((row) => this.map(row));
    } finally { connection.release(); }
  }

  private async execute(input: AlertCommand, targetState: SchedulerAlertState, actor: AuthorizationActor): Promise<SchedulerAlertEvent> {
    const trusted = await this.authorize(actor, input.applicationId);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await this.assertOwnership(connection, input);
      const commandHash = hash({ targetState, ...input });
      const replay = await rows(connection, `SELECT * FROM submission_scheduler_alert_events
        WHERE application_id=? AND idempotency_key=? FOR UPDATE`, [input.applicationId, input.idempotencyKey]);
      if (replay[0]) {
        if (text(replay[0], "command_hash") !== commandHash) throw new SchedulerAlertPersistenceError("IDEMPOTENCY_CONFLICT");
        await connection.commit(); return this.map(replay[0]);
      }
      const alertKey = schedulerAlertKey(input);
      const priorRows = await rows(connection, `SELECT * FROM submission_scheduler_alert_events
        WHERE alert_key=? ORDER BY version DESC LIMIT 1 FOR UPDATE`, [alertKey]);
      const prior = priorRows[0] ? this.map(priorRows[0]) : null;
      if (targetState === "CREATED" && prior) { await connection.commit(); return prior; }
      let result;
      try {
        result = appendSchedulerAlertEvent({ history: prior ? [prior] : [], eventId: randomUUID(), ...input,
          targetState, actorId: trusted.id, occurredAt: new Date().toISOString() });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message === "SCHEDULER_ALERT_VERSION_CONFLICT") throw new SchedulerAlertPersistenceError("CONCURRENCY_CONFLICT");
        throw new SchedulerAlertPersistenceError("INVALID_TRANSITION");
      }
      const event = result.event;
      const acknowledged = event.state === "ACKNOWLEDGED" ? new Date(event.occurredAt) : null;
      const resolved = event.state === "RESOLVED" ? new Date(event.occurredAt) : null;
      await connection.execute(`INSERT INTO submission_scheduler_alert_events
        (id,alert_key,application_id,applicant_id,travel_group_id,schedule_evaluation_id,alert_type,severity,category,alert_state,version,
         actor_reference,reason,context_json,correlation_id,idempotency_key,command_hash,acknowledged_at,acknowledged_by,resolved_at,resolved_by,occurred_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [event.id,event.alertKey,event.applicationId,event.applicantId,event.travelGroupId,
        event.scheduleEvaluationId,event.type,event.severity,event.category,event.state,event.version,event.actorId,event.reason,
        JSON.stringify(event.context),event.correlationId,event.idempotencyKey,commandHash,acknowledged,event.state === "ACKNOWLEDGED" ? event.actorId : null,
        resolved,event.state === "RESOLVED" ? event.actorId : null,new Date(event.occurredAt)]);
      await connection.execute(`INSERT INTO operations_audit_events
        (id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome,reason_code,metadata_json)
        VALUES (?,'OPERATIONS_SCHEDULER_ALERT',? ,?,'APPLICATION',?,'SUCCESS',?,?)`, [randomUUID(),event.actorId === "admin" ? "ADMIN" : "STAFF",
        event.actorId,String(event.applicationId),event.state,JSON.stringify({ alertId:event.id,alertKey:event.alertKey,version:event.version,type:event.type })]);
      await connection.commit(); return event;
    } catch (error) {
      try { await connection.rollback(); } catch { /* keep original sanitized error */ }
      if (error instanceof SchedulerAlertPersistenceError) throw error;
      throw new SchedulerAlertPersistenceError("PERSISTENCE_FAILURE");
    } finally { connection.release(); }
  }

  private async authorize(actor: AuthorizationActor, applicationId: number): Promise<AuthorizationActor> {
    let trusted: AuthorizationActor;
    try { trusted = await this.access.refreshTrustedActor(actor.id); }
    catch { throw new SchedulerAlertPersistenceError("FORBIDDEN"); }
    const flags = await this.access.featureFlags();
    const staff = /^staff:([1-9]\d*)$/.exec(trusted.id);
    const context = { environment: runtimeFlagEnvironment(), staffId: staff ? Number(staff[1]) : undefined, teamIds: trusted.teamIds };
    if (!isOperationsFlagEnabled("SUBMISSION_SCHEDULER", context, flags)) throw new SchedulerAlertPersistenceError("FEATURE_DISABLED");
    const connection = await this.pool.getConnection();
    try {
      const cases = await rows(connection, `SELECT c.assigned_staff_user_id AS assignedStaffId,c.team_id AS teamId,t.department_id AS departmentId
        FROM operations_case_controls c LEFT JOIN operations_teams t ON t.id=c.team_id WHERE c.application_id=?`, [applicationId]);
      const item = cases[0]; if (!item) throw new SchedulerAlertPersistenceError("NOT_FOUND");
      const assigned = integer(item,"assignedStaffId"), teamId=integer(item,"teamId"), departmentId=integer(item,"departmentId");
      if (!authorize(trusted,"case.transition",{ assignedActorId:assigned===null?undefined:`staff:${assigned}`, teamId:teamId??undefined,
        departmentId:departmentId??undefined }).allowed) throw new SchedulerAlertPersistenceError("FORBIDDEN");
      return trusted;
    } finally { connection.release(); }
  }

  private async assertOwnership(connection: PoolConnection, input: AlertCommand): Promise<void> {
    const records = await rows(connection, `SELECT g.application_id AS groupApplication,s.application_id AS scheduleApplication,
      s.travel_group_id AS scheduleGroup FROM travel_groups g JOIN submission_schedule_snapshots s ON s.id=?
      WHERE g.id=? AND g.application_id=?`, [input.scheduleEvaluationId,input.travelGroupId,input.applicationId]);
    const item=records[0]; if(!item || integer(item,"groupApplication")!==input.applicationId || integer(item,"scheduleApplication")!==input.applicationId
      || text(item,"scheduleGroup")!==input.travelGroupId) throw new SchedulerAlertPersistenceError("NOT_FOUND");
    if(input.applicantId!==null&&input.applicantId!==undefined) {
      const applicants=await rows(connection,"SELECT id FROM applicants WHERE id=? AND application_id=?",[input.applicantId,input.applicationId]);
      if(!applicants[0]) throw new SchedulerAlertPersistenceError("NOT_FOUND");
    }
  }

  private map(row: object): SchedulerAlertEvent {
    const state=text(row,"alert_state") as SchedulerAlertState|null, type=text(row,"alert_type") as SchedulerAlertType|null;
    const severity=text(row,"severity") as SchedulerAlertSeverity|null, category=text(row,"category") as SchedulerQueueCategory|null;
    const context=value(row,"context_json");
    const mapped={ id:text(row,"id"),alertKey:text(row,"alert_key"),applicationId:integer(row,"application_id"),applicantId:integer(row,"applicant_id"),
      travelGroupId:text(row,"travel_group_id"),scheduleEvaluationId:text(row,"schedule_evaluation_id"),type,severity,category,state,
      version:integer(row,"version"),actorId:text(row,"actor_reference"),reason:text(row,"reason"),context:typeof context==="string"?JSON.parse(context):context,
      correlationId:text(row,"correlation_id"),idempotencyKey:text(row,"idempotency_key"),occurredAt:date(row,"occurred_at") };
    if(!mapped.id||!mapped.alertKey||mapped.applicationId===null||!mapped.travelGroupId||!mapped.scheduleEvaluationId||!type||!severity||!category||!state
      ||mapped.version===null||!mapped.actorId||!mapped.reason||!mapped.correlationId||!mapped.idempotencyKey||!mapped.occurredAt||!mapped.context||typeof mapped.context!=="object")
      throw new SchedulerAlertPersistenceError("PERSISTENCE_FAILURE");
    return mapped as SchedulerAlertEvent;
  }
}
