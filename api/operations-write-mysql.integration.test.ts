import { randomUUID } from "node:crypto";
import { createPool, type Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TrpcContext } from "./context";
import { MysqlOperationsAccessProvider } from "./lib/operations/mysql-access-provider";
import { MysqlControlledWriteExecutor } from "./lib/operations/mysql-controlled-write-executor";
import { MysqlOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { createOperationsWriteRouter } from "./operations-write-router";

const databaseUrl = process.env.OPS_EXECUTOR_DATABASE_URL;
const integration = databaseUrl ? describe.sequential : describe.skip;

function insertedId(result: object): number {
  const value = Reflect.get(result, "insertId");
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error("Synthetic insert ID unavailable");
  return value;
}

integration("persistent Operations executor and internal API", () => {
  let pool: Pool;
  let staff1 = 0;
  let staff2 = 0;
  let wrongTeamStaff = 0;
  let team1 = 0;
  let team2 = 0;
  let applicationId = 0;
  let applicant1 = 0;
  let applicant2 = 0;
  let document1 = 0;
  let caller: ReturnType<ReturnType<typeof createOperationsWriteRouter>["createCaller"]>;
  let provider: MysqlOperationsAccessProvider;
  let executor: MysqlControlledWriteExecutor;

  const context = (staffId: number): TrpcContext => ({
    req: new Request("https://internal.invalid/api/trpc", { headers: { "x-operations-role": "OWNER", "x-team-id": "999" } }),
    resHeaders: new Headers(), isAdmin: false, staffId, customerApplicationReferences: new Set(),
  });

  async function scalar(sql: string, parameters: readonly (string | number)[] = []): Promise<number> {
    const [rows] = await pool.execute(sql, [...parameters]);
    if (!Array.isArray(rows) || !rows[0] || typeof rows[0] !== "object") throw new Error("Synthetic scalar unavailable");
    const value = Reflect.get(rows[0], "value");
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error("Synthetic scalar invalid");
    return parsed;
  }

  beforeAll(async () => {
    pool = createPool({ uri: databaseUrl ?? "", connectionLimit: 8 });
    const [department] = await pool.execute("INSERT INTO operations_departments (code,name) VALUES ('OPS_TEST','Operations Test')");
    const departmentId = insertedId(department);
    const [firstTeam] = await pool.execute("INSERT INTO operations_teams (department_id,code,name) VALUES (?,'TEAM_A','Team A')", [departmentId]);
    team1 = insertedId(firstTeam);
    const [secondTeam] = await pool.execute("INSERT INTO operations_teams (department_id,code,name) VALUES (?,'TEAM_B','Team B')", [departmentId]);
    team2 = insertedId(secondTeam);
    const createStaff = async (username: string) => {
      const [result] = await pool.execute("INSERT INTO staff_users (username,password_hash,name,is_active) VALUES (?,'synthetic-no-login',?,'active')", [username, username]);
      return insertedId(result);
    };
    staff1 = await createStaff("ops-staff-1"); staff2 = await createStaff("ops-staff-2"); wrongTeamStaff = await createStaff("ops-wrong-team");
    const [role] = await pool.execute("INSERT INTO operations_roles (code,name) VALUES ('OPS_TEST_ROLE','Operations Test Role')");
    const roleId = insertedId(role);
    const permissions = ["case.read_assigned", "case.assign", "case.transition", "document.review", "rule.review"];
    for (const code of permissions) {
      const [permission] = await pool.execute("INSERT INTO operations_permissions (code,description,risk_level) VALUES (?,'Synthetic','HIGH') ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)", [code]);
      await pool.execute("INSERT INTO operations_role_permissions (role_id,permission_id,granted_by) VALUES (?,?,'synthetic')", [roleId, insertedId(permission)]);
    }
    for (const staffId of [staff1, staff2, wrongTeamStaff]) {
      await pool.execute("INSERT INTO operations_staff_roles (staff_user_id,role_id,granted_by,valid_from) VALUES (?,?,'synthetic',UTC_TIMESTAMP())", [staffId, roleId]);
      await pool.execute("INSERT INTO operations_staff_workload_limits (staff_user_id,workload_limit,configured_by,reason) VALUES (?,10,'synthetic','Synthetic limit')", [staffId]);
    }
    await pool.execute("INSERT INTO operations_scope_grants (staff_user_id,scope_type,team_id,granted_by) VALUES (?,'TEAM',?,'synthetic'),(?,'TEAM',?,'synthetic'),(?,'TEAM',?,'synthetic')", [staff1, team1, staff2, team1, wrongTeamStaff, team2]);
    await pool.execute("INSERT INTO operations_feature_flags (flag_key,environment,enabled,scope_type,scope_reference,reason,changed_by) VALUES ('OPERATIONS_CONTROLLED_WRITES','TEST','YES','GLOBAL','','Synthetic API gate','synthetic'),('VISA_RULES_EVALUATION','TEST','YES','GLOBAL','','Synthetic API gate','synthetic')");
    const [application] = await pool.execute(
      "INSERT INTO applications (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status) VALUES (?,'family','non-gcc','ROUTE_TEST','regular','synthetic@example.invalid','000',1,100,'documents_received','paid')",
      [`OPS-${Date.now()}`]);
    applicationId = insertedId(application);
    const createApplicant = async (index: number, name: string) => {
      const [result] = await pool.execute("INSERT INTO applicants (application_id,applicant_index,full_name,nationality) VALUES (?,?,?,'SYNTHETIC')", [applicationId, index, name]);
      return insertedId(result);
    };
    applicant1 = await createApplicant(0, "Synthetic Applicant One"); applicant2 = await createApplicant(1, "Synthetic Applicant Two");
    const [document] = await pool.execute(
      "INSERT INTO documents (application_id,applicant_id,document_type,original_file_name,stored_file_name,mime_type,file_size,storage_path,upload_status) VALUES (?,?,'passport','synthetic.pdf','synthetic.pdf','application/pdf',10,'synthetic/path','uploaded')",
      [applicationId, applicant1]);
    document1 = insertedId(document);
    await pool.execute("INSERT INTO operations_case_controls (application_id,version,assigned_staff_user_id,team_id) VALUES (?,0,?,?)", [applicationId, staff1, team1]);

    const [source] = await pool.execute("INSERT INTO visa_rule_sources (authority,title,source_url,classification) VALUES ('Synthetic Authority','Synthetic Source',?,'OFFICIAL')", [`https://example.invalid/${randomUUID()}`]);
    const sourceId = insertedId(source); const snapshotId = randomUUID();
    await pool.execute("INSERT INTO visa_rule_source_snapshots (id,source_id,retrieved_at,fingerprint_sha256,content_reference,retrieval_status) VALUES (?,?,UTC_TIMESTAMP(),REPEAT('a',64),'synthetic','SUCCESS')", [snapshotId, sourceId]);
    const [set] = await pool.execute("INSERT INTO visa_rule_sets (stable_id,route_code,profile_code) VALUES ('OPS_BASE','ROUTE_TEST','ALL')");
    const setId = insertedId(set); const versionId = randomUUID();
    await pool.execute(
      "INSERT INTO visa_rule_versions (id,rule_set_id,version,status,classification,rule_layer,research_status,source_snapshot_id,effective_from,conditions_json,outcome_json,created_by) VALUES (?,?,1,'DRAFT','OFFICIAL','BASE_ROUTE','VALIDATED',?,DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY),JSON_ARRAY(),JSON_OBJECT('eligibility','ELIGIBLE','requirementCodes',JSON_ARRAY('PASSPORT'),'conditionalDocuments',JSON_ARRAY(),'explanationCode','SYNTHETIC_ELIGIBLE'),'synthetic')",
      [versionId, setId, snapshotId]);
    await pool.execute("INSERT INTO visa_rule_reviews (id,rule_version_id,decision,reviewer_reference,comment) VALUES (?,?, 'APPROVED','synthetic','Approved synthetic rule')", [randomUUID(), versionId]);
    await pool.execute("UPDATE visa_rule_versions SET status='ACTIVE' WHERE id=?", [versionId]);
    const evaluationId = randomUUID();
    await pool.execute(
      "INSERT INTO visa_rule_evaluation_runs (id,application_id,applicant_id,route_code,engine_version,final_eligibility_state,decision_reason,required_documents_json,conditional_documents_json,warnings_json,precedence_trace_json,evidence_sha256,evaluated_at) VALUES (?,?,?,'ROUTE_TEST','eligibility-v1','ELIGIBLE','Synthetic initial',JSON_ARRAY('PASSPORT'),JSON_ARRAY(),JSON_ARRAY(),JSON_ARRAY(),REPEAT('b',64),DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR))",
      [evaluationId, applicationId, applicant1]);
    await pool.execute("INSERT INTO visa_rule_evaluation_selections (id,application_id,applicant_id,evaluation_id,selection_reason,selected_by,selected_at) VALUES (?,?,?,?, 'Initial synthetic','system',DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR))", [randomUUID(), applicationId, applicant1, evaluationId]);

    provider = new MysqlOperationsAccessProvider(new MysqlOperationsSqlClient(pool));
    executor = new MysqlControlledWriteExecutor(pool, provider);
    caller = createOperationsWriteRouter({ actorForContext: (ctx) => provider.actorForContext(ctx), flagContextForContext: (ctx) => provider.flagContextForContext(ctx), flagsForContext: () => provider.featureFlags(), executor }).createCaller(context(staff1));
  });

  afterAll(async () => { if (pool) await pool.end(); });

  it("persists human review, audit, and restart-safe idempotency", async () => {
    const input = { applicationId, expectedVersion: 0, idempotencyKey: "human-review-001", reason: "Synthetic evidence reviewed", outcome: "APPROVED_FOR_NEXT_STEP" as const };
    const first = await caller.humanReview(input);
    expect(first).toMatchObject({ status: "APPLIED", version: 1 });
    expect(await caller.humanReview(input)).toMatchObject({ status: "IDEMPOTENT_REPLAY", auditEventId: first.auditEventId });
    const provider = new MysqlOperationsAccessProvider(new MysqlOperationsSqlClient(pool));
    const restarted = createOperationsWriteRouter({ actorForContext: (ctx) => provider.actorForContext(ctx), flagContextForContext: (ctx) => provider.flagContextForContext(ctx), flagsForContext: () => provider.featureFlags(), executor: new MysqlControlledWriteExecutor(pool, provider) }).createCaller(context(staff1));
    expect(await restarted.humanReview(input)).toMatchObject({ status: "IDEMPOTENT_REPLAY", auditEventId: first.auditEventId });
    expect(await scalar("SELECT COUNT(*) value FROM operations_action_events WHERE application_id=? AND action_type='HUMAN_REVIEW'", [applicationId])).toBe(1);
    expect(await scalar("SELECT COUNT(*) value FROM operations_audit_events WHERE resource_reference=? AND event_type='OPERATIONS_HUMAN_REVIEW'", [String(applicationId)])).toBe(1);
    await expect(caller.humanReview({ ...input, outcome: "NEEDS_CORRECTION" })).rejects.toMatchObject({ code: "CONFLICT", message: "IDEMPOTENCY_CONFLICT" });
  });

  it("rejects wrong-team and cross-applicant document writes without partial evidence", async () => {
    const provider = new MysqlOperationsAccessProvider(new MysqlOperationsSqlClient(pool));
    const wrongCaller = createOperationsWriteRouter({ actorForContext: (ctx) => provider.actorForContext(ctx), flagContextForContext: (ctx) => provider.flagContextForContext(ctx), flagsForContext: () => provider.featureFlags(), executor: new MysqlControlledWriteExecutor(pool, provider) }).createCaller(context(wrongTeamStaff));
    await expect(wrongCaller.humanReview({ applicationId, expectedVersion: 1, idempotencyKey: "wrong-team-001", reason: "Wrong team attempt", outcome: "NEEDS_CORRECTION" })).rejects.toMatchObject({ message: "OUT_OF_SCOPE" });
    await expect(caller.documentReview({ applicationId, expectedVersion: 1, applicantId: applicant2, documentId: document1, expectedDocumentVersion: 0, idempotencyKey: "wrong-owner-001", reason: "Wrong applicant document", outcome: "REJECTED" })).rejects.toMatchObject({ message: "PRECONDITION_FAILED" });
    expect(await scalar("SELECT version value FROM operations_case_controls WHERE application_id=?", [applicationId])).toBe(1);
  });

  it("persists applicant-scoped document review, assignment, and controlled status", async () => {
    expect(await caller.documentReview({ applicationId, expectedVersion: 1, applicantId: applicant1, documentId: document1, expectedDocumentVersion: 0, idempotencyKey: "document-review-001", reason: "Synthetic document readable", outcome: "ACCEPTED" })).toMatchObject({ version: 2 });
    await expect(caller.assignment({ applicationId, expectedVersion: 2, idempotencyKey: "reassign-invalid-001", reason: "Synthetic invalid team allocation", mode: "REASSIGN", assigneeId: `staff:${wrongTeamStaff}` }))
      .rejects.toMatchObject({ message: "PRECONDITION_FAILED" });
    expect(await caller.assignment({ applicationId, expectedVersion: 2, idempotencyKey: "reassign-001", reason: "Synthetic workload allocation", mode: "REASSIGN", assigneeId: `staff:${staff2}` })).toMatchObject({ version: 3 });
    expect(await scalar("SELECT team_id value FROM operations_action_events WHERE application_id=? AND correlation_id='reassign-001'", [applicationId])).toBe(team1);
    await expect(caller.assignment({ applicationId, expectedVersion: 3, idempotencyKey: "claim-collision-001", reason: "Synthetic collision attempt", mode: "CLAIM", assigneeId: `staff:${staff1}` }))
      .rejects.toMatchObject({ message: "PRECONDITION_FAILED" });
    expect(await caller.statusTransition({ applicationId, expectedVersion: 3, idempotencyKey: "status-transition-001", reason: "Synthetic review started", to: "under_review" })).toMatchObject({ version: 4 });
    await expect(caller.statusTransition({ applicationId, expectedVersion: 4, idempotencyKey: "status-invalid-001", reason: "Invalid synthetic jump", to: "completed" })).rejects.toMatchObject({ message: "INVALID_STATE_TRANSITION" });
  });

  it("preserves history and appends a new re-evaluation snapshot and selection", async () => {
    const [selectionRows] = await pool.execute("SELECT evaluation_id FROM visa_rule_evaluation_selections WHERE application_id=? AND applicant_id=? ORDER BY selected_at DESC,id DESC LIMIT 1", [applicationId, applicant1]);
    if (!Array.isArray(selectionRows) || !selectionRows[0] || typeof selectionRows[0] !== "object") throw new Error("Current selection unavailable");
    const currentId = Reflect.get(selectionRows[0], "evaluation_id");
    if (typeof currentId !== "string") throw new Error("Current evaluation invalid");
    expect(await caller.requestReevaluation({ applicationId, expectedVersion: 4, applicantId: applicant1, expectedCurrentEvaluationId: currentId, idempotencyKey: "reevaluate-001", reason: "Synthetic reviewed rule update" })).toMatchObject({ version: 5 });
    expect(await scalar("SELECT COUNT(*) value FROM visa_rule_evaluation_runs WHERE application_id=? AND applicant_id=?", [applicationId, applicant1])).toBe(2);
    expect(await scalar("SELECT COUNT(*) value FROM visa_rule_evaluation_selections WHERE application_id=? AND applicant_id=?", [applicationId, applicant1])).toBe(2);
    expect(await scalar("SELECT COUNT(*) value FROM visa_rule_evaluation_runs WHERE id=? AND decision_reason='Synthetic initial'", [currentId])).toBe(1);
  });

  it("rolls back business/version/action/idempotency if audit persistence fails", async () => {
    await pool.query("CREATE TRIGGER synthetic_operations_audit_failure BEFORE INSERT ON operations_audit_events FOR EACH ROW BEGIN IF NEW.event_type='OPERATIONS_HUMAN_REVIEW' AND NEW.reason_code='HUMAN_REVIEW' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic audit failure'; END IF; END");
    try {
      await expect(caller.humanReview({ applicationId, expectedVersion: 5, idempotencyKey: "audit-failure-001", reason: "Synthetic forced rollback", outcome: "NEEDS_CORRECTION" })).rejects.toMatchObject({ message: "PERSISTENCE_FAILURE" });
      expect(await scalar("SELECT version value FROM operations_case_controls WHERE application_id=?", [applicationId])).toBe(5);
      expect(await scalar("SELECT COUNT(*) value FROM operations_action_events WHERE application_id=? AND correlation_id='audit-failure-001'", [applicationId])).toBe(0);
      expect(await scalar("SELECT COUNT(*) value FROM operations_idempotency_records WHERE application_id=? AND idempotency_key='audit-failure-001'", [applicationId])).toBe(0);
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS synthetic_operations_audit_failure");
    }
  });

  it("commits one of two stale concurrent writes and keeps finance fields unchanged", async () => {
    const before = await pool.execute("SELECT supplier_cost_aed FROM applications WHERE id=?", [applicationId]);
    const commands = ["concurrent-a", "concurrent-b"].map((key) => caller.humanReview({ applicationId, expectedVersion: 5, idempotencyKey: key, reason: `Synthetic ${key}`, outcome: "MANUAL_REVIEW_REQUIRED" }));
    const settled = await Promise.allSettled(commands);
    expect(settled.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((item) => item.status === "rejected")).toHaveLength(1);
    const after = await pool.execute("SELECT supplier_cost_aed FROM applications WHERE id=?", [applicationId]);
    expect(after[0]).toEqual(before[0]);
  });

  it("returns one commit and one deterministic replay for concurrent duplicate commands", async () => {
    const input = { applicationId, expectedVersion: 6, idempotencyKey: "concurrent-same-001", reason: "Synthetic duplicate retry", outcome: "NEEDS_CORRECTION" as const };
    const results = await Promise.all([caller.humanReview(input), caller.humanReview(input)]);
    expect(results.map((result) => result.status).sort()).toEqual(["APPLIED", "IDEMPOTENT_REPLAY"]);
    expect(new Set(results.map((result) => result.auditEventId)).size).toBe(1);
    expect(await scalar("SELECT COUNT(*) value FROM operations_action_events WHERE application_id=? AND correlation_id='concurrent-same-001'", [applicationId])).toBe(1);
  });

  it("fails closed while the feature flag is disabled", async () => {
    await pool.execute("UPDATE operations_feature_flags SET enabled='NO' WHERE flag_key='OPERATIONS_CONTROLLED_WRITES' AND environment='TEST'");
    await expect(caller.humanReview({ applicationId, expectedVersion: 7, idempotencyKey: "feature-off-001", reason: "Feature disabled check", outcome: "NEEDS_CORRECTION" })).rejects.toMatchObject({ message: "Operations controlled writes are disabled" });
  });
});
