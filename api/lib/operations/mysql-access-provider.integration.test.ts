import { createPool, type Pool } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TrpcContext } from "../../context";
import { isOperationsFlagEnabled } from "../feature-flags/feature-flags";
import { MysqlOperationsAccessProvider } from "./mysql-access-provider";
import { MysqlOperationsSqlClient } from "./mysql-query-client";

const rehearsalUrl = process.env.OPS_REHEARSAL_DATABASE_URL;
const run = rehearsalUrl ? describe : describe.skip;

function insertedId(result: object): number {
  const value = Reflect.get(result, "insertId");
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error("Synthetic insert did not return an ID");
  return value;
}

run("MySQL Operations access integration", () => {
  let pool: Pool;
  let staffId = 0;
  let roleId = 0;
  let permissionId = 0;
  let departmentId = 0;
  let teamId = 0;
  const suffix = `provider_${process.pid}_${Date.now()}`;

  beforeAll(async () => {
    pool = createPool({ uri: rehearsalUrl ?? "", connectionLimit: 2 });
    const [staff] = await pool.execute(
      "INSERT INTO staff_users (username, password_hash, name, is_active) VALUES (?, 'synthetic-not-a-login', 'Synthetic Provider Test', 'active')",
      [suffix],
    );
    staffId = insertedId(staff);
    const [department] = await pool.execute("INSERT INTO operations_departments (code, name) VALUES (?, 'Synthetic Department')", [suffix]);
    departmentId = insertedId(department);
    const [team] = await pool.execute("INSERT INTO operations_teams (department_id, code, name) VALUES (?, ?, 'Synthetic Team')", [departmentId, suffix]);
    teamId = insertedId(team);
    const [role] = await pool.execute("INSERT INTO operations_roles (code, name) VALUES (?, 'Synthetic Role')", [suffix]);
    roleId = insertedId(role);
    const [permission] = await pool.execute(
      "INSERT INTO operations_permissions (code, description, risk_level) VALUES ('case.transition', 'Synthetic permission', 'HIGH') ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)",
    );
    permissionId = insertedId(permission);
    await pool.execute("INSERT INTO operations_role_permissions (role_id, permission_id, granted_by) VALUES (?, ?, 'synthetic-test')", [roleId, permissionId]);
    await pool.execute("INSERT INTO operations_staff_roles (staff_user_id, role_id, granted_by, valid_from) VALUES (?, ?, 'synthetic-test', UTC_TIMESTAMP())", [staffId, roleId]);
    await pool.execute("INSERT INTO operations_scope_grants (staff_user_id, scope_type, team_id, granted_by) VALUES (?, 'TEAM', ?, 'synthetic-test')", [staffId, teamId]);
    await pool.execute(
      "INSERT INTO operations_feature_flags (flag_key, environment, enabled, scope_type, scope_reference, reason, changed_by) VALUES ('OPERATIONS_CONTROLLED_WRITES', 'TEST', 'YES', 'TEAM', ?, 'synthetic integration test', 'synthetic-test')",
      [String(teamId)],
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.execute("DELETE FROM operations_feature_flags WHERE changed_by = 'synthetic-test' AND reason = 'synthetic integration test'");
    await pool.execute("DELETE FROM operations_scope_grants WHERE staff_user_id = ?", [staffId]);
    await pool.execute("DELETE FROM operations_staff_roles WHERE staff_user_id = ?", [staffId]);
    await pool.execute("DELETE FROM operations_role_permissions WHERE role_id = ?", [roleId]);
    await pool.execute("DELETE FROM operations_roles WHERE id = ?", [roleId]);
    await pool.execute("DELETE FROM operations_teams WHERE id = ?", [teamId]);
    await pool.execute("DELETE FROM operations_departments WHERE id = ?", [departmentId]);
    await pool.execute("DELETE FROM staff_users WHERE id = ?", [staffId]);
    await pool.end();
  });

  it("loads persisted permissions, scope, and a scoped enabled flag", async () => {
    const provider = new MysqlOperationsAccessProvider(new MysqlOperationsSqlClient(pool));
    const context: TrpcContext = {
      req: new Request("https://internal.invalid"),
      resHeaders: new Headers(),
      isAdmin: false,
      staffId,
      customerApplicationReferences: new Set(),
    };
    const actor = await provider.actorForContext(context);
    expect(actor.permissions.has("case.transition")).toBe(true);
    expect(actor.teamIds.has(teamId)).toBe(true);
    const flags = await provider.featureFlags();
    expect(isOperationsFlagEnabled("OPERATIONS_CONTROLLED_WRITES", { environment: "TEST", staffId, teamIds: actor.teamIds }, flags)).toBe(true);
  });
});
