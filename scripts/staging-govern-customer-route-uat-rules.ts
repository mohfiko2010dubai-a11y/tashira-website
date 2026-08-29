import { createHash, randomUUID } from "node:crypto";
import { createPool, type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { env } from "../api/lib/env";
import { OFFICIAL_SOURCE_POLICY_VERSION } from "../api/lib/rules/source-authority-policy";

/**
 * STAGING-ONLY synthetic UAT rules for the REAL customer visa routes.
 *
 * Purpose: let the Dynamic Form exercise the governed rule engine end-to-end
 * (per-nationality questions, per-applicant documents, evidence, conflicts)
 * on Staging before the owner approves official regulatory content.
 *
 * Safety:
 * - Refuses to run outside the tashira_staging database and the staging path.
 * - Every record is stamped STAGING_TEST_SYNTHETIC_NOT_REGULATORY and the
 *   review comment marks it prohibited from Production activation.
 * - Idempotent: re-running keeps exactly one governed ACTIVE version per rule.
 */
const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_RULE_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_RULE_PATH_IDENTITY_FAILED");

const authority = "STAGING_TEST_SYNTHETIC_NOT_REGULATORY";
const sourceUrl = "https://staging.tashiraev.com/internal/testing/customer-route-uat-rules-v1";
const retrievedAt = new Date("2026-08-30T00:00:00Z");
const action = process.argv[2] ?? "activate";
if (action !== "activate" && action !== "deactivate") throw new Error("STAGING_RULE_ACTION_INVALID");

const CUSTOMER_ROUTES = [
  "14days-single", "14days-multiple", "30days-single", "30days-multiple",
  "60days-single", "60days-multiple", "90days-single", "96hours-transit",
] as const;

type RuleSeed = { stableId: string; routeCode: string; profileCode: string; layer: string;
  conditions: readonly Record<string, unknown>[]; eligibility: "NO_CHANGE";
  requirements: readonly string[]; explanation: string };

const rules: readonly RuleSeed[] = CUSTOMER_ROUTES.flatMap((routeCode) => {
  const tag = routeCode.toUpperCase().replaceAll("-", "_");
  return [
    { stableId: `STAGING_TEST_ROUTE_${tag}_BASE`, routeCode, profileCode: "SYNTHETIC_BASE", layer: "BASE_ROUTE",
      conditions: [{ field: "nationality", operator: "EXISTS" }], eligibility: "NO_CHANGE",
      requirements: ["PASSPORT", "PERSONAL_PHOTO"],
      explanation: "Synthetic Staging base coverage for UAT only — not regulatory content." },
    { stableId: `STAGING_TEST_ROUTE_${tag}_EG`, routeCode, profileCode: "SYNTHETIC_EG", layer: "NATIONALITY_OVERLAY",
      conditions: [{ field: "nationality", operator: "EQUALS", value: "EG" }], eligibility: "NO_CHANGE",
      requirements: ["NATIONAL_ID"],
      explanation: "Synthetic Egyptian nationality overlay for UAT document variation." },
    { stableId: `STAGING_TEST_ROUTE_${tag}_PK`, routeCode, profileCode: "SYNTHETIC_PK", layer: "NATIONALITY_OVERLAY",
      conditions: [{ field: "nationality", operator: "EQUALS", value: "PK" }], eligibility: "NO_CHANGE",
      requirements: ["BANK_STATEMENT"],
      explanation: "Synthetic Pakistani nationality overlay for UAT document variation." },
    { stableId: `STAGING_TEST_ROUTE_${tag}_GCC`, routeCode, profileCode: "SYNTHETIC_GCC", layer: "GCC_OVERLAY",
      conditions: [{ field: "gccCountry", operator: "EXISTS" }, { field: "residenceExpiry", operator: "EXISTS" }], eligibility: "NO_CHANGE",
      requirements: ["GCC_RESIDENCE"],
      explanation: "Synthetic GCC-resident overlay for UAT document variation." },
    { stableId: `STAGING_TEST_ROUTE_${tag}_TICKETS`, routeCode, profileCode: "SYNTHETIC_TICKETS", layer: "OPERATIONAL_OVERLAY",
      conditions: [{ field: "hasConfirmedTickets", operator: "EQUALS", value: "true" }], eligibility: "NO_CHANGE",
      requirements: ["RETURN_TICKET"],
      explanation: "Synthetic confirmed-ticket overlay for UAT document variation." },
  ];
});

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
    const [result] = await connection.execute("INSERT INTO visa_rule_sources (authority,title,source_url,classification) VALUES (?, 'Synthetic Customer-Route UAT Rules',?,'INTERNAL')", [authority, sourceUrl]);
    sourceId = Number(Reflect.get(result, "insertId"));
  }
  const authorityRows = await rows(connection, `SELECT authority_type AS authorityType,decision FROM visa_rule_source_authority_events
    WHERE source_id=? ORDER BY occurred_at DESC,id DESC LIMIT 1 FOR UPDATE`, [sourceId]);
  if (!authorityRows[0]) {
    await connection.execute(`INSERT INTO visa_rule_source_authority_events
      (id,source_id,policy_version,authority_type,decision,actor_reference,reason,occurred_at)
      VALUES (?,?,?,'COMMERCIAL','APPROVED','staging-system:synthetic-rule-reviewer',?,?)`,
    [randomUUID(), sourceId, OFFICIAL_SOURCE_POLICY_VERSION,
      "Synthetic Staging UAT source only; not an official authority and prohibited from Production", retrievedAt]);
  } else if (String(authorityRows[0].authorityType) !== "COMMERCIAL" || String(authorityRows[0].decision) !== "APPROVED") {
    throw new Error("STAGING_RULE_SOURCE_AUTHORITY_COLLISION");
  }

  if (action === "deactivate") {
    await connection.execute(`UPDATE visa_rule_versions v JOIN visa_rule_sets s ON s.id=v.rule_set_id
      SET v.status='RETIRED' WHERE s.stable_id LIKE 'STAGING_TEST_ROUTE_%' AND v.status='ACTIVE'`);
    const remaining = await rows(connection, `SELECT COUNT(*) AS count FROM visa_rule_versions v JOIN visa_rule_sets s ON s.id=v.rule_set_id
      WHERE s.stable_id LIKE 'STAGING_TEST_ROUTE_%' AND v.status='ACTIVE'`);
    if (Number(remaining[0].count) !== 0) throw new Error("STAGING_RULE_DEACTIVATION_INCOMPLETE");
    await connection.commit();
    console.log("STAGING_TEST_CUSTOMER_ROUTE_RULES_ACTIVE=0");
    console.log("STAGING_TEST_RULE_ROLLBACK=PASS");
  } else {
  const fingerprint = createHash("sha256").update(JSON.stringify(rules)).digest("hex");
  const snapshotRows = await rows(connection, "SELECT id FROM visa_rule_source_snapshots WHERE source_id=? AND fingerprint_sha256=?", [sourceId, fingerprint]);
  const snapshotId = snapshotRows[0] ? String(snapshotRows[0].id) : randomUUID();
  if (!snapshotRows[0]) await connection.execute(`INSERT INTO visa_rule_source_snapshots
    (id,source_id,retrieved_at,fingerprint_sha256,content_reference,retrieval_status) VALUES (?,?,?,?,?,'SUCCESS')`,
  [snapshotId, sourceId, retrievedAt, fingerprint, "STAGING_TEST_SYNTHETIC_CUSTOMER_ROUTE_FIXTURE_V1"]);

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
        VALUES (?,?,1,'DRAFT','OPERATIONAL','VALIDATED',?,? ,?,?,?,?)`, [ruleVersionId, ruleSetId, snapshotId, retrievedAt,
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
    WHERE s.stable_id LIKE 'STAGING_TEST_ROUTE_%' AND v.status='ACTIVE'`);
  if (Number(active[0].count) !== rules.length) throw new Error("STAGING_RULE_ACTIVATION_INCOMPLETE");
  await connection.commit();
  console.log(`STAGING_TEST_CUSTOMER_ROUTE_RULES_ACTIVE=${rules.length}`);
  console.log("STAGING_TEST_RULE_GOVERNANCE=PASS");
  }
} catch (error) {
  await connection.rollback(); throw error;
} finally {
  connection.release(); await pool.end();
}
