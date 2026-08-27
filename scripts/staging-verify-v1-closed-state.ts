import { createPool, type RowDataPacket } from "mysql2/promise";
import { env } from "../api/lib/env";

const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_V1_GATE_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) {
  throw new Error("STAGING_V1_GATE_PATH_IDENTITY_FAILED");
}

const closedFlags = [
  "OPERATIONS_CONTROLLED_WRITES",
  "AI_DOCUMENT_REVIEW",
  "SUPPORT_INBOX",
  "REGULATORY_WATCHER",
  "DYNAMIC_CUSTOMER_APPLICATION",
  "CUSTOMER_PRECHECK",
  "CUSTOMER_OPERATIONS_PORTAL",
  "TYPING_PACK",
  "AUTHORITY_QUERY",
  "VISA_DELIVERY",
  "VISA_ASSISTANT",
  "CASE_CHAT_HANDOFF",
  "OPERATIONS_EMAIL_AUTOMATION",
] as const;

// One representative schema object from each additive migration. Migrations that
// only evolve an earlier table are represented by the resulting table itself.
const migrationObjects = [
  "operations_departments", "operations_audit_events", "visa_rule_sources",
  "visa_rule_evaluation_runs", "visa_rule_evaluation_selections", "family_relationship_events",
  "operations_case_controls", "operations_document_controls", "travel_groups",
  "submission_scheduler_alert_events", "requirement_definitions", "requirement_catalog_governance_events",
  "customer_interview_profile_events", "applicant_requirement_document_links", "operations_support_threads",
  "operations_supplier_sla_policies", "operations_typing_pack_templates", "operations_regulatory_changes",
  "operations_document_security_scans", "operations_email_dispatches", "operations_submission_policies",
  "travel_date_change_events", "visa_rule_source_authority_events", "visa_rule_governance_events",
] as const;

const pool = createPool({ uri: env.databaseUrl, connectionLimit: 1 });
try {
  const [identity] = await pool.execute<RowDataPacket[]>("SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion");
  if (identity.length !== 1 || identity[0].databaseName !== "tashira_staging") {
    throw new Error("STAGING_V1_GATE_DATABASE_IDENTITY_CHANGED");
  }

  const [schemaRows] = await pool.execute<RowDataPacket[]>(`SELECT TABLE_NAME AS tableName FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${migrationObjects.map(() => "?").join(",")})`, [...migrationObjects]);
  const present = new Set(schemaRows.map((row) => String(row.tableName)));
  const missing = migrationObjects.filter((table) => !present.has(table));
  if (missing.length > 0) throw new Error(`STAGING_V1_GATE_SCHEMA_INCOMPLETE:${missing.join(",")}`);

  const [enabledClosed] = await pool.execute<RowDataPacket[]>(`SELECT flag_key AS flagKey,scope_type AS scopeType,scope_reference AS scopeReference
    FROM operations_feature_flags WHERE environment='STAGING' AND enabled='YES'
    AND flag_key IN (${closedFlags.map(() => "?").join(",")}) ORDER BY flag_key,scope_type,scope_reference`, [...closedFlags]);
  if (enabledClosed.length > 0) {
    throw new Error(`STAGING_V1_GATE_CLOSED_FLAG_ENABLED:${enabledClosed.map((row) => String(row.flagKey)).join(",")}`);
  }

  const [productionFlags] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM operations_feature_flags
    WHERE environment='PRODUCTION' AND enabled='YES'`);
  if (Number(productionFlags[0].count) !== 0) throw new Error("STAGING_V1_GATE_PRODUCTION_FLAG_PRESENT");

  console.log("STAGING_V1_ENVIRONMENT_IDENTITY=PASS");
  console.log(`STAGING_V1_MYSQL_VERSION=${String(identity[0].mysqlVersion)}`);
  console.log("STAGING_V1_SCHEMA_OBJECTS_014_041=PASS");
  console.log("STAGING_V1_CONTROLLED_WRITES=OFF");
  console.log("STAGING_V1_CUSTOMER_FEATURES=OFF");
  console.log("STAGING_V1_EXTERNAL_PROVIDER_FEATURES=OFF");
  console.log("STAGING_V1_PRODUCTION_SCOPES=ABSENT");
} finally {
  await pool.end();
}
