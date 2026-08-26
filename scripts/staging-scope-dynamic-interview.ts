import { createPool, type RowDataPacket } from "mysql2/promise";
import { env } from "../api/lib/env";

const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_SCOPE_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_SCOPE_PATH_IDENTITY_FAILED");

const allowed = new Set(["TSH-STG-DYN-INDIVIDUAL", "TSH-STG-DYN-GCC-FUTURE", "TSH-STG-DYN-FAMILY",
  "TSH-STG-DYN-NOT-RESEARCHED", "TSH-STG-DYN-CONFLICT"]);
const [mode, reference] = process.argv.slice(2);
if ((mode !== "enable" && mode !== "disable") || !reference || !allowed.has(reference)) throw new Error("STAGING_SCOPE_ARGUMENT_INVALID");
const enabled = mode === "enable" ? "YES" : "NO";
const flags = ["DYNAMIC_CUSTOMER_APPLICATION", "VISA_RULES_EVALUATION", "DYNAMIC_REQUIREMENTS"] as const;
const pool = createPool({ uri: env.databaseUrl, connectionLimit: 1 });
try {
  const [applications] = await pool.execute<RowDataPacket[]>("SELECT id FROM applications WHERE reference_number=?", [reference]);
  if (applications.length !== 1) throw new Error("STAGING_SCOPE_APPLICATION_MISSING");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const flag of flags) await connection.execute(`INSERT INTO operations_feature_flags
      (flag_key,environment,enabled,scope_type,scope_reference,reason,changed_by) VALUES (?,'STAGING',?,'APPLICATION',?,?,?)
      ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),reason=VALUES(reason),changed_by=VALUES(changed_by)`,
    [flag, enabled, reference, `Scoped synthetic Unified Interview E2E ${mode}`, "staging-system:unified-interview-e2e"]);
    const [verified] = await connection.execute<RowDataPacket[]>(`SELECT flag_key,enabled FROM operations_feature_flags
      WHERE environment='STAGING' AND scope_type='APPLICATION' AND scope_reference=? AND flag_key IN (?,?,?) ORDER BY flag_key`,
    [reference, ...flags]);
    if (verified.length !== flags.length || verified.some((row) => String(row.enabled) !== enabled)) throw new Error("STAGING_SCOPE_VERIFICATION_FAILED");
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  console.log(`STAGING_DYNAMIC_INTERVIEW_SCOPE=${reference}`);
  console.log(`STAGING_DYNAMIC_INTERVIEW_FLAGS=${enabled}`);
} finally { await pool.end(); }
