import { createHash, randomUUID } from "node:crypto";
import { createPool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { env } from "../api/lib/env";

const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_RULE_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_RULE_PATH_IDENTITY_FAILED");

const authority = "STAGING_TEST_SYNTHETIC_NOT_REGULATORY";
const sourceUrl = "https://staging.tashiraev.com/internal/testing/dynamic-interview-rules-v1";
const retrievedAt = new Date("2026-08-26T00:00:00Z");
type RuleSeed = { stableId: string; routeCode: string; profileCode: string; layer: string;
  conditions: readonly Record<string, unknown>[]; eligibility: "ELIGIBLE" | "INELIGIBLE" | "NO_CHANGE";
  requirements: readonly string[]; explanation: string };

const rules: readonly RuleSeed[] = [
  { stableId: "STAGING_TEST_BASE_ELIGIBLE", routeCode: "STAGING_TEST_DYNAMIC", profileCode: "SYNTHETIC_BASE", layer: "BASE_ROUTE",
    conditions: [{ field: "nationality", operator: "EXISTS" }], eligibility: "ELIGIBLE", requirements: ["PASSPORT", "PERSONAL_PHOTO"],
    explanation: "Synthetic Staging coverage for adaptive interview testing only." },
  { stableId: "STAGING_TEST_EGYPT_REQUIREMENTS", routeCode: "STAGING_TEST_DYNAMIC", profileCode: "SYNTHETIC_EG", layer: "NATIONALITY_OVERLAY",
    conditions: [{ field: "nationality", operator: "EQUALS", value: "EG" }], eligibility: "NO_CHANGE", requirements: ["NATIONAL_ID"],
    explanation: "Synthetic Egyptian profile requirements for isolated Staging tests." },
  { stableId: "STAGING_TEST_PAKISTAN_REQUIREMENTS", routeCode: "STAGING_TEST_DYNAMIC", profileCode: "SYNTHETIC_PK", layer: "NATIONALITY_OVERLAY",
    conditions: [{ field: "nationality", operator: "EQUALS", value: "PK" }], eligibility: "NO_CHANGE", requirements: ["BANK_STATEMENT"],
    explanation: "Synthetic Pakistani profile requirements for isolated Staging tests." },
  { stableId: "STAGING_TEST_GCC_REQUIREMENTS", routeCode: "STAGING_TEST_DYNAMIC", profileCode: "SYNTHETIC_GCC", layer: "GCC_OVERLAY",
    conditions: [{ field: "gccCountry", operator: "EXISTS" }, { field: "residenceExpiry", operator: "EXISTS" }], eligibility: "NO_CHANGE",
    requirements: ["GCC_RESIDENCE"], explanation: "Synthetic GCC profile requirements for isolated Staging tests." },
  { stableId: "STAGING_TEST_CONFLICT_ALLOW", routeCode: "STAGING_TEST_CONFLICT", profileCode: "SYNTHETIC_CONFLICT", layer: "BASE_ROUTE",
    conditions: [{ field: "nationality", operator: "EXISTS" }], eligibility: "ELIGIBLE", requirements: ["PASSPORT"],
    explanation: "Synthetic positive decision used only to prove conflict handling." },
  { stableId: "STAGING_TEST_CONFLICT_DENY", routeCode: "STAGING_TEST_CONFLICT", profileCode: "SYNTHETIC_CONFLICT", layer: "BASE_ROUTE",
    conditions: [{ field: "nationality", operator: "EXISTS" }], eligibility: "INELIGIBLE", requirements: ["PASSPORT"],
    explanation: "Synthetic negative decision used only to prove conflict handling." },
];

async function rows(connection: PoolConnection, sql: string, values: readonly unknown[] = []): Promise<RowDataPacket[]> {
  const [result] = await connection.execute<RowDataPacket[]>(sql, [...values]); return result;
}

const pool = createPool({ uri: env.databaseUrl, connectionLimit: 1 });
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  const sourceRows = await rows(connection, "SELECT id,authority FROM visa_rule_sources WHERE source_url_sha256=UNHEX(SHA2(?,256)) FOR UPDATE", [sourceUrl]);
  let sourceId: number;
  if (sourceRows[0]) {
    if (String(sourceRows[0].authority) !== authority) throw new Error("STAGING_RULE_SOURCE_COLLISION");
    sourceId = Number(sourceRows[0].id);
  } else {
    const [result] = await connection.execute("INSERT INTO visa_rule_sources (authority,title,source_url,classification) VALUES (?, 'Synthetic Dynamic Interview Browser E2E',?,'INTERNAL')", [authority, sourceUrl]);
    sourceId = Number(Reflect.get(result, "insertId"));
  }
  const fingerprint = createHash("sha256").update(JSON.stringify(rules)).digest("hex");
  const snapshotRows = await rows(connection, "SELECT id FROM visa_rule_source_snapshots WHERE source_id=? AND fingerprint_sha256=?", [sourceId, fingerprint]);
  const snapshotId = snapshotRows[0] ? String(snapshotRows[0].id) : randomUUID();
  if (!snapshotRows[0]) await connection.execute(`INSERT INTO visa_rule_source_snapshots
    (id,source_id,retrieved_at,fingerprint_sha256,content_reference,retrieval_status) VALUES (?,?,?,?,?,'SUCCESS')`,
  [snapshotId, sourceId, retrievedAt, fingerprint, "STAGING_TEST_SYNTHETIC_FIXTURE_V1"]);

  for (const seed of rules) {
    let setRows = await rows(connection, "SELECT id,route_code AS routeCode,profile_code AS profileCode FROM visa_rule_sets WHERE stable_id=? FOR UPDATE", [seed.stableId]);
    if (!setRows[0]) {
      await connection.execute("INSERT INTO visa_rule_sets (stable_id,route_code,profile_code) VALUES (?,?,?)", [seed.stableId, seed.routeCode, seed.profileCode]);
      setRows = await rows(connection, "SELECT id,route_code AS routeCode,profile_code AS profileCode FROM visa_rule_sets WHERE stable_id=? FOR UPDATE", [seed.stableId]);
    }
    if (String(setRows[0].routeCode) !== seed.routeCode || String(setRows[0].profileCode) !== seed.profileCode) throw new Error("STAGING_RULE_SET_COLLISION");
    const ruleSetId = Number(setRows[0].id);
    const existing = await rows(connection, "SELECT id,status FROM visa_rule_versions WHERE rule_set_id=? AND version=1 FOR UPDATE", [ruleSetId]);
    let ruleVersionId: string;
    if (existing[0]) ruleVersionId = String(existing[0].id);
    else {
      ruleVersionId = randomUUID();
      await connection.execute(`INSERT INTO visa_rule_versions
        (id,rule_set_id,version,status,classification,research_status,source_snapshot_id,effective_from,conditions_json,outcome_json,created_by,rule_layer)
        VALUES (?,?,1,'DRAFT','OFFICIAL','VALIDATED',?,? ,?,?,?,?)`, [ruleVersionId, ruleSetId, snapshotId, retrievedAt,
        JSON.stringify(seed.conditions), JSON.stringify({ eligibility: seed.eligibility, requirementCodes: seed.requirements, conditionalDocuments: [], explanationCode: seed.explanation }),
        "staging-system:synthetic-rule-proposer", seed.layer]);
    }
    const statusRows = await rows(connection, "SELECT status FROM visa_rule_versions WHERE id=?", [ruleVersionId]);
    let status = String(statusRows[0].status);
    if (status === "DRAFT") { await connection.execute("UPDATE visa_rule_versions SET status='UNDER_REVIEW' WHERE id=? AND status='DRAFT'", [ruleVersionId]); status = "UNDER_REVIEW"; }
    const reviewRows = await rows(connection, "SELECT id FROM visa_rule_reviews WHERE rule_version_id=? AND decision='APPROVED'", [ruleVersionId]);
    if (!reviewRows[0]) await connection.execute(`INSERT INTO visa_rule_reviews
      (id,rule_version_id,decision,reviewer_reference,comment) VALUES (?,?,'APPROVED','staging-system:synthetic-rule-reviewer','STAGING_TEST only; not regulatory evidence and prohibited from Production activation')`, [randomUUID(), ruleVersionId]);
    if (status === "UNDER_REVIEW") { await connection.execute("UPDATE visa_rule_versions SET status='APPROVED' WHERE id=? AND status='UNDER_REVIEW'", [ruleVersionId]); status = "APPROVED"; }
    if (status === "APPROVED") await connection.execute("UPDATE visa_rule_versions SET status='ACTIVE' WHERE id=? AND status='APPROVED'", [ruleVersionId]);
  }
  const active = await rows(connection, `SELECT COUNT(*) AS count FROM visa_rule_versions v JOIN visa_rule_sets s ON s.id=v.rule_set_id
    WHERE s.stable_id LIKE 'STAGING_TEST_%' AND v.status='ACTIVE'`);
  if (Number(active[0].count) !== rules.length) throw new Error("STAGING_RULE_ACTIVATION_INCOMPLETE");
  await connection.commit();
  console.log(`STAGING_TEST_RULES_ACTIVE=${rules.length}`);
  console.log("STAGING_TEST_RULE_GOVERNANCE=PASS");
} catch (error) {
  await connection.rollback(); throw error;
} finally {
  connection.release(); await pool.end();
}
