import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import type { AuthorizationActor } from "../authorization/policy";
import { MysqlOperationsAccessProvider } from "../operations/mysql-access-provider";
import { MysqlOperationsSqlClient } from "../operations/mysql-query-client";
import { MysqlSchedulerAlertProvider, SchedulerAlertPersistenceError } from "./mysql-scheduler-alert-provider";

const enabled = process.env.RUN_SCHEDULER_ALERT_MYSQL_INTEGRATION === "1";

describe.skipIf(!enabled)("MySQL scheduler alert persistence", () => {
  let pool: Pool;
  let provider: MysqlSchedulerAlertProvider;
  let actor: AuthorizationActor;
  let wrongTeamActor: AuthorizationActor;
  let applicationId: number;
  let travelGroupId: string;
  let scheduleEvaluationId: string;
  let auditBefore = 0;

  beforeAll(async () => {
    const uri = process.env.SCHEDULER_ALERT_MYSQL_URL;
    if (!uri) throw new Error("SCHEDULER_ALERT_MYSQL_URL_REQUIRED");
    pool = createPool({ uri, connectionLimit: 3 });
    const [fixtureRows] = await pool.query(`SELECT a.id applicationId,g.id travelGroupId,s.id scheduleEvaluationId
      FROM applications a JOIN travel_groups g ON g.application_id=a.id
      JOIN submission_schedule_snapshots s ON s.travel_group_id=g.id LIMIT 1`);
    const fixture = Array.isArray(fixtureRows) ? fixtureRows[0] as Record<string, unknown> | undefined : undefined;
    if (!fixture) throw new Error("SCHEDULER_ALERT_FIXTURE_REQUIRED");
    applicationId = Number(fixture.applicationId); travelGroupId = String(fixture.travelGroupId);
    scheduleEvaluationId = randomUUID();
    await pool.execute(`INSERT INTO submission_schedule_snapshots
      (id,application_id,travel_group_id,route_code,applicant_id,planned_arrival_date,earliest_safe_submission_date,target_submission_date,
       latest_safe_submission_date,entry_validity_rule_id,entry_validity_rule_version,entry_validity_days,stay_duration_rule_id,
       stay_duration_rule_version,operational_submission_policy_id,operational_submission_policy_version,processing_time_assumption_days,
       operational_buffer_days,schedule_state,reason,blocking_reasons_json,rule_versions_json,matched_rule_ids_json,
       source_evidence_references_json,recalculation_reason,evaluator_version,evidence_sha256,evaluated_at)
      SELECT ?,application_id,travel_group_id,route_code,applicant_id,planned_arrival_date,earliest_safe_submission_date,target_submission_date,
       latest_safe_submission_date,entry_validity_rule_id,entry_validity_rule_version,entry_validity_days,stay_duration_rule_id,
       stay_duration_rule_version,operational_submission_policy_id,operational_submission_policy_version,processing_time_assumption_days,
       operational_buffer_days,schedule_state,reason,blocking_reasons_json,rule_versions_json,matched_rule_ids_json,
       source_evidence_references_json,'SCHEDULER_ALERT_INTEGRATION',evaluator_version,evidence_sha256,UTC_TIMESTAMP()
      FROM submission_schedule_snapshots WHERE id=?`, [scheduleEvaluationId, String(fixture.scheduleEvaluationId)]);
    const suffix = Date.now().toString();
    const [department] = await pool.execute("INSERT INTO operations_departments (code,name) VALUES (?,?)", [`ALERT-${suffix}`, "Synthetic Alert Department"]);
    const departmentId = Number(Reflect.get(department, "insertId"));
    const [team] = await pool.execute("INSERT INTO operations_teams (department_id,code,name) VALUES (?,?,?)", [departmentId, `ALERT-${suffix}`, "Synthetic Alert Team"]);
    const teamId = Number(Reflect.get(team, "insertId"));
    const [wrongTeam] = await pool.execute("INSERT INTO operations_teams (department_id,code,name) VALUES (?,?,?)", [departmentId, `WRONG-${suffix}`, "Wrong Synthetic Team"]);
    const wrongTeamId = Number(Reflect.get(wrongTeam, "insertId"));
    const [role] = await pool.execute("INSERT INTO operations_roles (code,name) VALUES (?,?)", [`ALERT-${suffix}`, "Scheduler Alert Operator"]);
    const roleId = Number(Reflect.get(role, "insertId"));
    await pool.execute("INSERT INTO operations_permissions (code,description,risk_level) VALUES ('case.transition','Synthetic scheduler alert permission','HIGH'),('case.read','Synthetic scheduler read permission','LOW') ON DUPLICATE KEY UPDATE code=VALUES(code)");
    const [permissionRows] = await pool.query("SELECT id FROM operations_permissions WHERE code IN ('case.transition','case.read')");
    for (const permission of permissionRows as object[]) await pool.execute(
      "INSERT INTO operations_role_permissions (role_id,permission_id,granted_by) VALUES (?,?,?)", [roleId,Number(Reflect.get(permission,"id")),"synthetic-test"]);
    const createStaff = async (username: string, scopedTeamId: number) => {
      const [staff] = await pool.execute("INSERT INTO staff_users (username,password_hash,name,is_active) VALUES (?,'synthetic-no-login',?,'active')", [username,username]);
      const staffId = Number(Reflect.get(staff,"insertId"));
      await pool.execute("INSERT INTO operations_staff_roles (staff_user_id,role_id,granted_by,valid_from) VALUES (?,?,?,UTC_TIMESTAMP())",[staffId,roleId,"synthetic-test"]);
      await pool.execute("INSERT INTO operations_scope_grants (staff_user_id,scope_type,team_id,granted_by) VALUES (?,'TEAM',?,?)",[staffId,scopedTeamId,"synthetic-test"]);
      return staffId;
    };
    const staffId=await createStaff(`alert-${suffix}`,teamId), wrongStaffId=await createStaff(`wrong-${suffix}`,wrongTeamId);
    await pool.execute("INSERT INTO operations_case_controls (application_id,version,team_id) VALUES (?,0,?) ON DUPLICATE KEY UPDATE team_id=VALUES(team_id)",[applicationId,teamId]);
    await pool.execute("INSERT INTO operations_feature_flags (flag_key,environment,enabled,scope_type,scope_reference,reason,changed_by) VALUES ('SUBMISSION_SCHEDULER','TEST','YES','TEAM',?,'Synthetic alert integration','synthetic-test')",[String(teamId)]);
    const access = new MysqlOperationsAccessProvider(new MysqlOperationsSqlClient(pool)); provider = new MysqlSchedulerAlertProvider(pool,access);
    actor={id:`staff:${staffId}`,permissions:new Set(),scopes:[],teamIds:new Set(),departmentIds:new Set()};
    wrongTeamActor={...actor,id:`staff:${wrongStaffId}`};
    const [auditRows] = await pool.query("SELECT COUNT(*) count FROM operations_audit_events WHERE event_type='OPERATIONS_SCHEDULER_ALERT' AND resource_reference=?",[String(applicationId)]);
    auditBefore = Number(Reflect.get((auditRows as object[])[0],"count"));
  });
  afterAll(async () => { await pool?.end(); });

  it("persists deduplicated lifecycle, concurrency, idempotency, RBAC and audit evidence", async () => {
    const common={applicationId,travelGroupId,scheduleEvaluationId,type:"DUE_SOON" as const,severity:"WARNING" as const,
      category:"DUE_SOON" as const,correlationId:randomUUID(),reason:"Synthetic due-soon condition",context:{blocking:false}};
    const created=await provider.create({...common,idempotencyKey:randomUUID()},actor);
    expect(created.state).toBe("CREATED");
    const duplicate=await provider.create({...common,idempotencyKey:randomUUID()},actor);
    expect(duplicate.id).toBe(created.id);
    const ackKey=randomUUID();
    const transition = { applicationId, alertId: created.id, expectedVersion: 1, idempotencyKey: ackKey,
      correlationId: common.correlationId, reason: "Synthetic acknowledgement" };
    const acknowledged=await provider.acknowledge(transition,actor);
    expect(acknowledged.state).toBe("ACKNOWLEDGED");
    expect((await provider.acknowledge(transition,actor)).id).toBe(acknowledged.id);
    await expect(provider.acknowledge({...transition,reason:"Conflicting payload"},actor))
      .rejects.toMatchObject({code:"IDEMPOTENCY_CONFLICT"});
    await expect(provider.resolve({ ...transition, alertId: acknowledged.id, expectedVersion:1,idempotencyKey:randomUUID(),reason:"Stale resolve"},actor))
      .rejects.toMatchObject({code:"CONCURRENCY_CONFLICT"});
    const resolved=await provider.resolve({ ...transition, alertId: acknowledged.id, expectedVersion:2,idempotencyKey:randomUUID(),reason:"Condition resolved"},actor);
    expect(resolved.state).toBe("RESOLVED");
    const listed = await provider.listForApplication(applicationId,actor);
    expect(listed).toContainEqual(resolved);
    expect(listed.filter((item) => item.alertKey === resolved.alertKey)).toEqual([resolved]);
    await expect(provider.listForApplication(applicationId,wrongTeamActor)).rejects.toBeInstanceOf(SchedulerAlertPersistenceError);
    const [audit] = await pool.query("SELECT COUNT(*) count FROM operations_audit_events WHERE event_type='OPERATIONS_SCHEDULER_ALERT' AND resource_reference=?",[String(applicationId)]);
    expect(Number(Reflect.get((audit as object[])[0],"count"))).toBe(auditBefore + 3);
    expect(JSON.stringify(listed)).not.toMatch(/cost|margin|profit|stripe|payout/i);
  });
});
