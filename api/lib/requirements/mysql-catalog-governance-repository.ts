import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { AuthorizationActor } from "../authorization/policy";
import type { CatalogDefinitionKind, CatalogGovernanceState } from "./catalog-governance";
import { validateCatalogImport } from "./requirement-catalog-seed";

const transitions: Readonly<Record<CatalogGovernanceState, readonly CatalogGovernanceState[]>> = {
  DRAFT: ["REVIEW"], REVIEW: ["APPROVED", "REJECTED"], APPROVED: ["ACTIVE"], ACTIVE: ["SUPERSEDED", "RETIRED"],
  REJECTED: ["DRAFT"], SUPERSEDED: [], RETIRED: [],
};
function requirePermission(actor: AuthorizationActor, permission: "rule.read" | "rule.propose" | "rule.review" | "rule.activate"): void {
  if (!actor.permissions.has(permission)) throw new Error("CATALOG_GOVERNANCE_ACCESS_DENIED");
}
function transitionPermission(state: CatalogGovernanceState) {
  if (state === "REVIEW" || state === "DRAFT") return "rule.propose" as const;
  if (state === "APPROVED" || state === "REJECTED") return "rule.review" as const;
  return "rule.activate" as const;
}
function table(kind: CatalogDefinitionKind): "requirement_definitions" | "requirement_question_definitions" {
  return kind === "REQUIREMENT" ? "requirement_definitions" : "requirement_question_definitions";
}
function lifecycle(state: CatalogGovernanceState): { status: "DRAFT" | "ACTIVE" | "RETIRED"; review: "PENDING" | "APPROVED" | "REJECTED" } {
  if (state === "ACTIVE") return { status: "ACTIVE", review: "APPROVED" };
  if (state === "SUPERSEDED" || state === "RETIRED") return { status: "RETIRED", review: "APPROVED" };
  if (state === "APPROVED") return { status: "DRAFT", review: "APPROVED" };
  if (state === "REJECTED") return { status: "DRAFT", review: "REJECTED" };
  return { status: "DRAFT", review: "PENDING" };
}
async function transaction<T>(pool: Pool, work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

export class MysqlCatalogGovernanceRepository {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async importDraft(input: unknown, actor: AuthorizationActor, occurredAt: Date): Promise<{ importId: string; imported: number; sha256: string }> {
    requirePermission(actor, "rule.propose");
    const { catalog, sha256 } = validateCatalogImport(input); const importId = randomUUID();
    return transaction(this.pool, async (connection) => {
      await connection.execute(`INSERT INTO requirement_catalog_imports (id,import_version,content_sha256,imported_by,definition_count,question_count,created_at) VALUES (?,?,?,?,?,?,?)`,
        [importId, catalog.importVersion, sha256, actor.id, catalog.requirements.length, catalog.questions.length, occurredAt]);
      for (const definition of catalog.requirements) {
        await connection.execute(`INSERT INTO requirement_definitions (id,stable_code,version,status,governance_state,record_version,document_type,customer_label,short_customer_explanation,internal_label,classification,authority_semantics,reason_template,category,required_capability,conditional_capability,shared_document_capability,applicant_scoped_capability,travel_group_scoped_capability,family_scoped_capability,ai_extraction_capability,human_review_policy,effective_from,effective_to,created_by,review_status,source_metadata_json) VALUES (?,?,?,'DRAFT','DRAFT',1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING',?)`,
          [definition.definitionId, definition.code, definition.version, definition.documentType, definition.customerLabel,
            definition.shortCustomerExplanation, definition.internalLabel, definition.classification, definition.authoritySemantics,
            definition.reasonTemplate, definition.category, definition.requiredCapability, definition.conditionalCapability,
            definition.sharedDocumentCapability, definition.applicantScopedCapability, definition.travelGroupScopedCapability,
            definition.familyScopedCapability, definition.aiExtractionCapability, definition.humanReviewPolicy,
            definition.effectiveFrom, definition.effectiveTo, actor.id, JSON.stringify({ environment: "STAGING_TEST_SAFE", importId })]);
        await this.insertEvent(connection, definition.definitionId, "REQUIREMENT", null, "DRAFT", actor.id, `CATALOG_IMPORT:${catalog.importVersion}`, sha256, occurredAt);
      }
      for (const definition of catalog.questions) {
        await connection.execute(`INSERT INTO requirement_question_definitions (id,stable_code,version,status,governance_state,record_version,question_type,customer_label,short_customer_explanation,internal_label,classification,authority_semantics,reason_template,help_text,answer_type,allowed_values_json,validation_contract_json,customer_visible,effective_from,effective_to,created_by,review_status,source_metadata_json) VALUES (?,?,?,'DRAFT','DRAFT',1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING',?)`,
          [definition.definitionId, definition.code, definition.version, definition.questionType, definition.customerLabel,
            definition.shortCustomerExplanation, definition.internalLabel, definition.classification, definition.authoritySemantics,
            definition.reasonTemplate, definition.helpText, definition.answerType, definition.allowedValues ? JSON.stringify(definition.allowedValues) : null,
            JSON.stringify(definition.validationContract), definition.customerVisible, definition.effectiveFrom, definition.effectiveTo,
            actor.id, JSON.stringify({ environment: "STAGING_TEST_SAFE", importId })]);
        await this.insertEvent(connection, definition.definitionId, "QUESTION", null, "DRAFT", actor.id, `CATALOG_IMPORT:${catalog.importVersion}`, sha256, occurredAt);
      }
      return { importId, imported: catalog.requirements.length + catalog.questions.length, sha256 };
    });
  }

  async transition(input: { definitionId: string; kind: CatalogDefinitionKind; expectedVersion: number; toState: CatalogGovernanceState; reason: string }, actor: AuthorizationActor, occurredAt: Date) {
    requirePermission(actor, transitionPermission(input.toState)); if (!input.reason.trim()) throw new Error("CATALOG_REASON_REQUIRED");
    return transaction(this.pool, async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>(`SELECT governance_state AS state,record_version AS recordVersion FROM ${table(input.kind)} WHERE id=? FOR UPDATE`, [input.definitionId]);
      const row = rows[0]; if (!row) throw new Error("CATALOG_DEFINITION_NOT_FOUND");
      const state = String(row.state) as CatalogGovernanceState; const version = Number(row.recordVersion);
      if (version !== input.expectedVersion) throw new Error("CATALOG_VERSION_CONFLICT");
      if (!transitions[state].includes(input.toState)) throw new Error("CATALOG_TRANSITION_INVALID");
      const next = lifecycle(input.toState);
      const [result] = await connection.execute(`UPDATE ${table(input.kind)} SET governance_state=?,status=?,review_status=?,reviewed_by=?,reviewed_at=?,record_version=record_version+1 WHERE id=? AND record_version=?`,
        [input.toState, next.status, next.review, actor.id, occurredAt, input.definitionId, input.expectedVersion]);
      if (Reflect.get(result, "affectedRows") !== 1) throw new Error("CATALOG_VERSION_CONFLICT");
      await this.insertEvent(connection, input.definitionId, input.kind, state, input.toState, actor.id, input.reason.trim(), "0".repeat(64), occurredAt);
      return { definitionId: input.definitionId, kind: input.kind, state: input.toState, recordVersion: version + 1 };
    });
  }

  async editDraft(input: { definitionId: string; kind: CatalogDefinitionKind; expectedVersion: number; customerLabel: string;
    shortCustomerExplanation: string; internalLabel: string; classification: "OFFICIAL" | "OPERATIONAL" | "CONDITIONAL" | "OPTIONAL" | "INTERNAL";
    authoritySemantics: string | null; reasonTemplate: string; effectiveFrom: Date; effectiveTo: Date | null; reason: string }, actor: AuthorizationActor, occurredAt: Date) {
    requirePermission(actor, "rule.propose");
    return transaction(this.pool, async (connection) => {
      const [rows] = await connection.execute<RowDataPacket[]>(`SELECT governance_state AS state,record_version AS recordVersion FROM ${table(input.kind)} WHERE id=? FOR UPDATE`, [input.definitionId]);
      const row = rows[0]; if (!row) throw new Error("CATALOG_DEFINITION_NOT_FOUND");
      if (String(row.state) !== "DRAFT" && String(row.state) !== "REJECTED") throw new Error("CATALOG_DEFINITION_IMMUTABLE");
      if (Number(row.recordVersion) !== input.expectedVersion) throw new Error("CATALOG_VERSION_CONFLICT");
      const [result] = await connection.execute(`UPDATE ${table(input.kind)} SET customer_label=?,short_customer_explanation=?,internal_label=?,classification=?,authority_semantics=?,reason_template=?,effective_from=?,effective_to=?,governance_state='DRAFT',status='DRAFT',review_status='PENDING',record_version=record_version+1 WHERE id=? AND record_version=?`,
        [input.customerLabel, input.shortCustomerExplanation, input.internalLabel, input.classification, input.authoritySemantics,
          input.reasonTemplate, input.effectiveFrom, input.effectiveTo, input.definitionId, input.expectedVersion]);
      if (Reflect.get(result, "affectedRows") !== 1) throw new Error("CATALOG_VERSION_CONFLICT");
      await this.insertEvent(connection, input.definitionId, input.kind, "DRAFT", "DRAFT", actor.id, input.reason, "0".repeat(64), occurredAt);
      return { definitionId: input.definitionId, kind: input.kind, state: "DRAFT" as const, recordVersion: input.expectedVersion + 1 };
    });
  }

  async list(actor: AuthorizationActor): Promise<readonly object[]> {
    requirePermission(actor, "rule.read");
    const [requirements, questions] = await Promise.all([
      this.pool.query(`SELECT id AS definitionId,'REQUIREMENT' AS kind,stable_code AS code,version,governance_state AS state,record_version AS recordVersion,customer_label AS customerLabel,classification,effective_from AS effectiveFrom,effective_to AS effectiveTo FROM requirement_definitions ORDER BY stable_code,version`),
      this.pool.query(`SELECT id AS definitionId,'QUESTION' AS kind,stable_code AS code,version,governance_state AS state,record_version AS recordVersion,customer_label AS customerLabel,classification,effective_from AS effectiveFrom,effective_to AS effectiveTo FROM requirement_question_definitions ORDER BY stable_code,version`),
    ]);
    return [...requirements[0] as RowDataPacket[], ...questions[0] as RowDataPacket[]];
  }

  private async insertEvent(connection: PoolConnection, definitionId: string, kind: CatalogDefinitionKind, from: CatalogGovernanceState | null,
    to: CatalogGovernanceState, actor: string, reason: string, payloadSha256: string, occurredAt: Date) {
    await connection.execute(`INSERT INTO requirement_catalog_governance_events (id,definition_id,definition_kind,from_state,to_state,actor_reference,reason,payload_sha256,occurred_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      [randomUUID(), definitionId, kind, from, to, actor, reason, payloadSha256, occurredAt]);
  }
}
