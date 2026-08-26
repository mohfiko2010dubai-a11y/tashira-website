import { createPool } from "mysql2/promise";
import type { AuthorizationActor } from "../api/lib/authorization/policy";
import { env } from "../api/lib/env";
import { MysqlCatalogGovernanceRepository } from "../api/lib/requirements/mysql-catalog-governance-repository";
import { buildGenericCatalogSeed, GENERIC_QUESTION_CODES, GENERIC_REQUIREMENT_CODES } from "../api/lib/requirements/requirement-catalog-seed";

const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_CATALOG_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_CATALOG_PATH_IDENTITY_FAILED");

function actor(id: string, permission: "rule.propose" | "rule.review" | "rule.activate"): AuthorizationActor {
  return { id, permissions: new Set(["rule.read", permission]), scopes: ["GLOBAL"], teamIds: new Set(), departmentIds: new Set() };
}

const pool = createPool({ uri: env.databaseUrl, connectionLimit: 2 });
try {
  const repository = new MysqlCatalogGovernanceRepository(pool);
  const proposer = actor("staging-system:catalog-proposer", "rule.propose");
  const reviewer = actor("staging-system:catalog-reviewer", "rule.review");
  const activator = actor("staging-system:catalog-activator", "rule.activate");
  let definitions = await repository.list(proposer) as readonly { definitionId: string; kind: "REQUIREMENT" | "QUESTION"; code: string;
    state: "DRAFT" | "REVIEW" | "APPROVED" | "ACTIVE" | "REJECTED" | "SUPERSEDED" | "RETIRED"; recordVersion: number }[];
  if (definitions.length === 0) {
    const imported = await repository.importDraft(buildGenericCatalogSeed(), proposer, new Date());
    if (imported.imported !== GENERIC_REQUIREMENT_CODES.length + GENERIC_QUESTION_CODES.length) throw new Error("STAGING_CATALOG_IMPORT_COUNT_INVALID");
    definitions = await repository.list(proposer) as typeof definitions;
  }
  const expected = new Set<string>([...GENERIC_REQUIREMENT_CODES.map((code) => `REQUIREMENT:${code}`), ...GENERIC_QUESTION_CODES.map((code) => `QUESTION:${code}`)]);
  if (definitions.length !== expected.size || definitions.some((definition) => !expected.has(`${definition.kind}:${definition.code}`))) {
    throw new Error("STAGING_CATALOG_CONTENT_MISMATCH");
  }
  for (const definition of definitions) {
    let state = definition.state; let recordVersion = definition.recordVersion;
    for (const next of ["REVIEW", "APPROVED", "ACTIVE"] as const) {
      if (state === next || state === "ACTIVE") continue;
      const transitionActor = next === "REVIEW" ? proposer : next === "APPROVED" ? reviewer : activator;
      const result = await repository.transition({ definitionId: definition.definitionId, kind: definition.kind,
        expectedVersion: recordVersion, toState: next, reason: `STAGING_TEST_SAFE_${next}` }, transitionActor, new Date());
      state = result.state; recordVersion = result.recordVersion;
    }
  }
  const active = await repository.list(proposer) as typeof definitions;
  const requirements = active.filter(({ kind, state }) => kind === "REQUIREMENT" && state === "ACTIVE").length;
  const questions = active.filter(({ kind, state }) => kind === "QUESTION" && state === "ACTIVE").length;
  if (requirements !== GENERIC_REQUIREMENT_CODES.length || questions !== GENERIC_QUESTION_CODES.length) throw new Error("STAGING_CATALOG_ACTIVATION_INCOMPLETE");
  console.log(`STAGING_CATALOG_ACTIVE=${requirements}/${questions}`);
  console.log("STAGING_CATALOG_GOVERNANCE=PASS");
} finally {
  await pool.end();
}
