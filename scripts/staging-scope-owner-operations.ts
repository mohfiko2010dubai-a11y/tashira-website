import { createPool, type RowDataPacket } from "mysql2/promise";
import { env } from "../api/lib/env";

const expectedDirectory = "/var/www/tashira-staging";
const ownerUsername = "staging-owner";
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
    for (const flag of safeOwnerAcceptanceFlags) {
      await connection.execute(
        `INSERT INTO operations_feature_flags
          (flag_key,environment,enabled,scope_type,scope_reference,reason,changed_by)
         VALUES (?,'STAGING',?,'STAFF',?,?,?)
         ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),reason=VALUES(reason),changed_by=VALUES(changed_by)`,
        [flag, enabled, String(staffId), `Scoped owner acceptance ${mode}`, "staging-system:owner-acceptance"],
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
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  console.log(`STAGING_OWNER_OPERATIONS_FLAGS=${enabled}`);
  console.log(`STAGING_OWNER_OPERATIONS_FLAG_COUNT=${safeOwnerAcceptanceFlags.length}`);
  console.log("REGULATORY_WATCHER=OFF");
  console.log("CUSTOMER_FACING_FLAGS=UNCHANGED");
} finally {
  await pool.end();
}

