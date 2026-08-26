import { createPool, type RowDataPacket } from "mysql2/promise";
import { env } from "../api/lib/env";

const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_PORTAL_SCOPE_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_PORTAL_SCOPE_PATH_IDENTITY_FAILED");
const allowed = new Set(["TSH-STG-DYN-INDIVIDUAL", "TSH-STG-DYN-GCC-FUTURE", "TSH-STG-DYN-FAMILY",
  "TSH-STG-DYN-NOT-RESEARCHED", "TSH-STG-DYN-CONFLICT"]);
const [mode, reference] = process.argv.slice(2);
if ((mode !== "enable" && mode !== "disable") || !reference || !allowed.has(reference)) throw new Error("STAGING_PORTAL_SCOPE_ARGUMENT_INVALID");
const enabled = mode === "enable" ? "YES" : "NO";
const pool = createPool({ uri: env.databaseUrl, connectionLimit: 1 });
try {
  const [applications] = await pool.execute<RowDataPacket[]>("SELECT id FROM applications WHERE reference_number=?", [reference]);
  if (applications.length !== 1) throw new Error("STAGING_PORTAL_SCOPE_APPLICATION_MISSING");
  await pool.execute(`INSERT INTO operations_feature_flags
    (flag_key,environment,enabled,scope_type,scope_reference,reason,changed_by) VALUES ('CUSTOMER_OPERATIONS_PORTAL','STAGING',?,'APPLICATION',?,?,?)
    ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),reason=VALUES(reason),changed_by=VALUES(changed_by)`,
  [enabled, reference, `Scoped synthetic Customer Portal E2E ${mode}`, "staging-system:customer-portal-e2e"]);
  const [verified] = await pool.execute<RowDataPacket[]>(`SELECT enabled FROM operations_feature_flags WHERE flag_key='CUSTOMER_OPERATIONS_PORTAL'
    AND environment='STAGING' AND scope_type='APPLICATION' AND scope_reference=?`, [reference]);
  if (verified.length !== 1 || String(verified[0].enabled) !== enabled) throw new Error("STAGING_PORTAL_SCOPE_VERIFICATION_FAILED");
  console.log(`STAGING_CUSTOMER_PORTAL_SCOPE=${reference}`);
  console.log(`STAGING_CUSTOMER_PORTAL_FLAG=${enabled}`);
} finally { await pool.end(); }
