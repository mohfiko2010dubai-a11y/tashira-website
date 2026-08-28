import { randomUUID } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { env } from "../api/lib/env";
import { PERMISSIONS } from "../api/lib/authorization/permissions";

const expectedDirectory = "/var/www/tashira-staging";
const ownerUsername = "staging-owner";
const acceptanceRoleCode = "STAGING_OWNER_ACCEPTANCE";
const grantedBy = "staging-system:owner-acceptance";
const safeOwnerAcceptanceFlags = [
  "SUBMISSION_SCHEDULER",
  "SUPPORT_INBOX",
  "SUPPLIER_SLA",
  "MANAGER_DASHBOARD",
  "OPERATIONS_ANALYTICS",
  "DOCUMENT_INTELLIGENCE",
] as const;

const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_OWNER_SCOPE_DATABASE_IDENTITY_FAILED");
if (process.cwd().replaceAll("\\", "/") !== expectedDirectory) throw new Error("STAGING_OWNER_SCOPE_PATH_IDENTITY_FAILED");

const [mode] = process.argv.slice(2);
if (mode !== "enable" && mode !== "disable") throw new Error("STAGING_OWNER_SCOPE_ARGUMENT_INVALID");
const enabled = mode === "enable" ? "YES" : "NO";
const pool = createPool({ uri: env.databaseUrl, connectionLimit: 1 });

try {
  const [staff] = await pool.execute<RowDataPacket[]>(
    "SELECT id,is_active AS isActive FROM staff_users WHERE username=?",
    [ownerUsername],
  );
  if (staff.length !== 1 || String(staff[0].isActive) !== "active") {
    throw new Error("STAGING_OWNER_SCOPE_ACCOUNT_MISSING");
  }
  const staffId = Number(staff[0].id);
  if (!Number.isSafeInteger(staffId) || staffId <= 0) throw new Error("STAGING_OWNER_SCOPE_ACCOUNT_INVALID");

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO operations_roles (code,name,is_system,is_active)
       VALUES (?,?,'NO','ACTIVE')
       ON DUPLICATE KEY UPDATE name=VALUES(name),is_active='ACTIVE'`,
      [acceptanceRoleCode, "Staging Owner Acceptance"],
    );
    const [roles] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM operations_roles WHERE code=? AND is_active='ACTIVE'",
      [acceptanceRoleCode],
    );
    if (roles.length !== 1) throw new Error("STAGING_OWNER_SCOPE_ROLE_INVALID");
    const roleId = Number(roles[0].id);
    const [permissionRows] = await connection.execute<RowDataPacket[]>(
      `SELECT id,code FROM operations_permissions WHERE code IN (${PERMISSIONS.map(() => "?").join(",")})`,
      [...PERMISSIONS],
    );
    if (permissionRows.length !== PERMISSIONS.length) {
      const existing = new Set(permissionRows.map((row) => String(row.code)));
      console.log(`STAGING_OWNER_MISSING_PERMISSIONS=${PERMISSIONS.filter((code) => !existing.has(code)).join(",")}`);
      throw new Error("STAGING_OWNER_SCOPE_PERMISSION_CATALOG_INCOMPLETE");
    }

    if (mode === "enable") {
      for (const permission of permissionRows) {
        await connection.execute(
          "INSERT IGNORE INTO operations_role_permissions (role_id,permission_id,granted_by) VALUES (?,?,?)",
          [roleId, Number(permission.id), grantedBy],
        );
      }
      await connection.execute(
        `INSERT INTO operations_staff_roles (staff_user_id,role_id,granted_by,valid_from)
         SELECT ?,?,?,UTC_TIMESTAMP() WHERE NOT EXISTS (
           SELECT 1 FROM operations_staff_roles
            WHERE staff_user_id=? AND role_id=? AND revoked_at IS NULL
              AND valid_from<=UTC_TIMESTAMP() AND (valid_to IS NULL OR valid_to>UTC_TIMESTAMP())
         )`,
        [staffId, roleId, grantedBy, staffId, roleId],
      );
      await connection.execute(
        `INSERT INTO operations_scope_grants (staff_user_id,scope_type,granted_by)
         SELECT ?,'ALL',? WHERE NOT EXISTS (
           SELECT 1 FROM operations_scope_grants
            WHERE staff_user_id=? AND scope_type='ALL' AND revoked_at IS NULL AND granted_by=?
         )`,
        [staffId, grantedBy, staffId, grantedBy],
      );
    } else {
      await connection.execute(
        `UPDATE operations_staff_roles sr JOIN operations_roles r ON r.id=sr.role_id
            SET sr.revoked_at=UTC_TIMESTAMP()
          WHERE sr.staff_user_id=? AND r.code=? AND sr.granted_by=? AND sr.revoked_at IS NULL`,
        [staffId, acceptanceRoleCode, grantedBy],
      );
      await connection.execute(
        `UPDATE operations_scope_grants SET revoked_at=UTC_TIMESTAMP()
          WHERE staff_user_id=? AND scope_type='ALL' AND granted_by=? AND revoked_at IS NULL`,
        [staffId, grantedBy],
      );
    }
    for (const flag of safeOwnerAcceptanceFlags) {
      await connection.execute(
        `INSERT INTO operations_feature_flags
          (flag_key,environment,enabled,scope_type,scope_reference,reason,changed_by)
         VALUES (?,'STAGING',?,'STAFF',?,?,?)
         ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),reason=VALUES(reason),changed_by=VALUES(changed_by)`,
        [flag, enabled, String(staffId), `Scoped owner acceptance ${mode}`, grantedBy],
      );
    }
    const [verified] = await connection.execute<RowDataPacket[]>(
      `SELECT flag_key AS flagKey,enabled
         FROM operations_feature_flags
        WHERE environment='STAGING' AND scope_type='STAFF' AND scope_reference=?
          AND flag_key IN (${safeOwnerAcceptanceFlags.map(() => "?").join(",")})
        ORDER BY flag_key`,
      [String(staffId), ...safeOwnerAcceptanceFlags],
    );
    if (verified.length !== safeOwnerAcceptanceFlags.length
      || verified.some((row) => String(row.enabled) !== enabled)) {
      throw new Error("STAGING_OWNER_SCOPE_VERIFICATION_FAILED");
    }
    const [access] = await connection.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT p.code) AS permissionCount,
              MAX(CASE WHEN sg.scope_type='ALL' AND sg.revoked_at IS NULL THEN 1 ELSE 0 END) AS hasAllScope
         FROM operations_staff_roles sr
         JOIN operations_roles r ON r.id=sr.role_id AND r.code=? AND r.is_active='ACTIVE'
         JOIN operations_role_permissions rp ON rp.role_id=r.id
         JOIN operations_permissions p ON p.id=rp.permission_id
         LEFT JOIN operations_scope_grants sg ON sg.staff_user_id=sr.staff_user_id
        WHERE sr.staff_user_id=? AND sr.revoked_at IS NULL`,
      [acceptanceRoleCode, staffId],
    );
    if (mode === "enable" && (Number(access[0]?.permissionCount) !== PERMISSIONS.length || Number(access[0]?.hasAllScope) !== 1)) {
      throw new Error("STAGING_OWNER_SCOPE_RBAC_VERIFICATION_FAILED");
    }
    await connection.execute(
      `INSERT INTO operations_audit_events
        (id,event_type,actor_type,actor_reference,resource_type,resource_reference,outcome,reason_code,metadata_json)
       VALUES (?,'STAGING_OWNER_ACCEPTANCE_SCOPE','SYSTEM',?,'STAFF_ACCESS',?,'SUCCESS',?,?)`,
      [randomUUID(), grantedBy, String(staffId), mode.toUpperCase(), JSON.stringify({
        environment: "STAGING", scope: "STAFF", flags: safeOwnerAcceptanceFlags, permissionCount: PERMISSIONS.length,
      })],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  console.log(`STAGING_OWNER_OPERATIONS_FLAGS=${enabled}`);
  console.log(`STAGING_OWNER_OPERATIONS_FLAG_COUNT=${safeOwnerAcceptanceFlags.length}`);
  console.log(`STAGING_OWNER_PERMISSION_COUNT=${mode === "enable" ? PERMISSIONS.length : 0}`);
  console.log(`STAGING_OWNER_ALL_SCOPE=${mode === "enable" ? "YES" : "NO"}`);
  console.log("REGULATORY_WATCHER=OFF");
  console.log("CUSTOMER_FACING_FLAGS=UNCHANGED");
} finally {
  await pool.end();
}
