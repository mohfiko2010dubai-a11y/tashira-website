import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { authorize, type AuthorizationActor } from "../authorization/policy";
import { evidenceIntegrityReference, resolveApplicantField, validateAuthorityFieldRequirement, type AuthorityFieldRequirement,
  type AuthorityFieldSourceType, type ExtractedFieldEvidence } from "./contracts";
import { validateProviderResult, type CanonicalDocumentIntelligenceResult } from "./provider";
import type { DocumentRoutingDecision } from "./routing";

export type PersistDocumentIntelligenceInput = {
  requestKey: string;
  applicationReference: string;
  applicantId: number;
  documentId: number;
  passportProfileId: string | null;
  providerResult: CanonicalDocumentIntelligenceResult;
  routing: DocumentRoutingDecision;
  pageCount: number;
  callCount: number;
  evidence: readonly ExtractedFieldEvidence[];
  requirements: readonly AuthorityFieldRequirement[];
  occurredAt: string;
};
export type PersistDocumentIntelligenceResult = {
  runId: string;
  applicationId: number;
  applicantId: number;
  documentId: number;
  evidenceCount: number;
  selectionCount: number;
  replayed: boolean;
};

function digest(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function text(row: object, key: string): string | null { const value = Reflect.get(row, key); return typeof value === "string" ? value : null; }
function integer(row: object, key: string): number { const value = Number(Reflect.get(row, key)); if (!Number.isSafeInteger(value) || value < 0) throw new Error("DOCUMENT_INTELLIGENCE_ROW_INVALID"); return value; }
function jsonArray<T>(row: object, key: string): readonly T[] { const value = Reflect.get(row, key); const parsed: unknown = typeof value === "string" ? JSON.parse(value) : Buffer.isBuffer(value) ? JSON.parse(value.toString("utf8")) : value; if (!Array.isArray(parsed)) throw new Error("DOCUMENT_INTELLIGENCE_ROW_INVALID"); return parsed as readonly T[]; }
function allowedSources(values: readonly string[]): readonly AuthorityFieldSourceType[] {
  const allowed: ReadonlySet<string> = new Set(["PASSPORT_MRZ", "PASSPORT_VISUAL", "NATIONAL_ID", "RESIDENCE_DOCUMENT", "TICKET", "CUSTOMER_DECLARED", "STAFF_VERIFIED", "AUTHORITY_RESPONSE"]);
  if (values.some((value) => !allowed.has(value))) throw new Error("DOCUMENT_INTELLIGENCE_SOURCE_INVALID");
  return values as readonly AuthorityFieldSourceType[];
}

export class MysqlDocumentIntelligenceRepository {
  readonly #pool: Pool;
  constructor(pool: Pool) { this.#pool = pool; }

  async activeRequirements(input: { authorityCode: string; visaRouteCode: string; evaluatedAt: Date; environment: "TEST" | "STAGING" | "PRODUCTION" }): Promise<readonly AuthorityFieldRequirement[]> {
    if (Number.isNaN(input.evaluatedAt.getTime())) throw new Error("AUTHORITY_FIELD_EVALUATED_AT_INVALID");
    const [rows] = await this.#pool.execute<RowDataPacket[]>(`SELECT id requirementId,authority_code authorityCode,visa_route_code visaRouteCode,
      field_code fieldCode,field_label fieldLabel,requirement_kind requirementKind,nationality_scopes_json nationalityScopes,
      residence_scopes_json residenceScopes,family_minor_scope familyMinorScope,travel_party_scope travelPartyScope,
      preferred_sources_json preferredSources,fallback_sources_json fallbackSources,validation_rule validationRule,
      DATE_FORMAT(effective_from,'%Y-%m-%dT%H:%i:%s.000Z') effectiveFrom,
      IF(effective_to IS NULL,NULL,DATE_FORMAT(effective_to,'%Y-%m-%dT%H:%i:%s.000Z')) effectiveTo,
      source_evidence_json sourceEvidence,rule_version_id ruleVersionId,approval_state approvalState
      FROM authority_application_field_requirements WHERE authority_code=? AND visa_route_code=? AND approval_state='ACTIVE'
      AND (staging_test_only=false OR ?=true) AND effective_from<=? AND (effective_to IS NULL OR effective_to>?) ORDER BY field_code,id`,
    [input.authorityCode, input.visaRouteCode, input.environment !== "PRODUCTION", input.evaluatedAt, input.evaluatedAt]);
    return rows.map((row) => validateAuthorityFieldRequirement({ requirementId: text(row, "requirementId") ?? "", authorityCode: text(row, "authorityCode") ?? "",
      visaRouteCode: text(row, "visaRouteCode") ?? "", fieldCode: text(row, "fieldCode") ?? "", fieldLabel: text(row, "fieldLabel") ?? "",
      requirement: text(row, "requirementKind") as AuthorityFieldRequirement["requirement"],
      nationalityScopes: jsonArray<string>(row, "nationalityScopes"), residenceScopes: jsonArray<string>(row, "residenceScopes"),
      familyMinorScope: text(row, "familyMinorScope"), travelPartyScope: text(row, "travelPartyScope"),
      preferredSources: allowedSources(jsonArray<string>(row, "preferredSources")), fallbackSources: allowedSources(jsonArray<string>(row, "fallbackSources")),
      validationRule: text(row, "validationRule") ?? "", effectiveFrom: text(row, "effectiveFrom") ?? "", effectiveTo: text(row, "effectiveTo"),
      sourceEvidenceReferences: jsonArray<string>(row, "sourceEvidence"), ruleVersionId: text(row, "ruleVersionId") ?? "",
      approvalState: text(row, "approvalState") as AuthorityFieldRequirement["approvalState"] }));
  }

  async persist(input: PersistDocumentIntelligenceInput, actor: AuthorizationActor): Promise<PersistDocumentIntelligenceResult> {
    if (!input.requestKey.trim() || input.requestKey.length > 100 || !Number.isSafeInteger(input.pageCount) || input.pageCount < 1
      || !Number.isSafeInteger(input.callCount) || input.callCount < 0 || Number.isNaN(Date.parse(input.occurredAt))) {
      throw new Error("DOCUMENT_INTELLIGENCE_INPUT_INVALID");
    }
    validateProviderResult(input.providerResult);
    input.requirements.forEach(validateAuthorityFieldRequirement);
    const connection = await this.#pool.getConnection();
    try {
      await connection.beginTransaction();
      const resource = await this.#resource(connection, input.applicationReference, input.applicantId, input.documentId);
      if (!authorize(actor, "document.review", { assignedActorId: resource.assignedActorId, teamId: resource.teamId, departmentId: resource.departmentId }).allowed) {
        throw new Error("DOCUMENT_INTELLIGENCE_ACCESS_DENIED");
      }
      const payloadSha256 = digest({ input, actorId: actor.id });
      const [replays] = await connection.execute<RowDataPacket[]>(`SELECT id runId,request_sha256 requestSha256,application_id applicationId,
        applicant_id applicantId,document_id documentId FROM document_intelligence_runs WHERE application_id=? AND request_key=? FOR UPDATE`,
      [resource.applicationId, input.requestKey]);
      if (replays[0]) {
        if (text(replays[0], "requestSha256") !== payloadSha256) throw new Error("DOCUMENT_INTELLIGENCE_IDEMPOTENCY_CONFLICT");
        const [counts] = await connection.execute<RowDataPacket[]>(`SELECT
          (SELECT COUNT(*) FROM document_field_evidence WHERE run_id=?) evidenceCount,
          (SELECT COUNT(*) FROM applicant_field_selection_events WHERE run_id=?) selectionCount`, [text(replays[0], "runId"), text(replays[0], "runId")]);
        await connection.commit();
        return { runId: text(replays[0], "runId") ?? "", applicationId: integer(replays[0], "applicationId"), applicantId: integer(replays[0], "applicantId"),
          documentId: integer(replays[0], "documentId"), evidenceCount: integer(counts[0] ?? {}, "evidenceCount"),
          selectionCount: integer(counts[0] ?? {}, "selectionCount"), replayed: true };
      }
      if (input.passportProfileId) {
        const [profiles] = await connection.execute<RowDataPacket[]>("SELECT id FROM passport_profile_versions WHERE id=?", [input.passportProfileId]);
        if (!profiles[0]) throw new Error("DOCUMENT_INTELLIGENCE_PROFILE_NOT_FOUND");
      }
      if (input.evidence.some((item) => item.applicationId !== resource.applicationId || item.applicantId !== input.applicantId
        || item.documentId !== input.documentId)) throw new Error("DOCUMENT_INTELLIGENCE_EVIDENCE_OWNERSHIP_INVALID");
      const runId = randomUUID();
      await connection.execute(`INSERT INTO document_intelligence_runs
        (id,request_key,request_sha256,application_id,applicant_id,document_id,passport_profile_id,provider,model_version,processing_tier,
         processing_tiers_json,page_count,call_count,processing_cost,currency,escalation_reasons_json,warnings_json,result_sha256,processed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [runId, input.requestKey, payloadSha256, resource.applicationId, input.applicantId,
        input.documentId, input.passportProfileId, input.providerResult.provider, input.providerResult.modelVersion, input.routing.finalTier,
        JSON.stringify(input.routing.tiers), input.pageCount, input.callCount, input.routing.estimatedCost, input.providerResult.processingCurrency,
        JSON.stringify(input.routing.escalationReasons), JSON.stringify(input.providerResult.warnings), digest(input.providerResult), new Date(input.occurredAt)]);
      for (const item of input.evidence) await connection.execute(`INSERT INTO document_field_evidence
        (id,run_id,application_id,applicant_id,document_id,field_code,raw_value_reference,extracted_value,normalized_value,source_type,
         confidence,customer_confirmed,staff_verified,verified_at,verification_state,extracted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [item.evidenceId, runId, resource.applicationId, input.applicantId, input.documentId, item.fieldCode, item.rawValueReference,
        item.extractedValue, item.normalizedValue, item.sourceType, item.confidence, item.customerConfirmed, item.staffVerified,
        item.verifiedAt ? new Date(item.verifiedAt) : null, item.state, new Date(item.extractedAt)]);
      let selectionCount = 0;
      for (const requirement of input.requirements) {
        const matching = input.evidence.filter((item) => item.fieldCode === requirement.fieldCode);
        const resolution = resolveApplicantField({ applicationId: resource.applicationId, applicantId: input.applicantId,
          fieldCode: requirement.fieldCode, evidence: matching, preferredSources: [...requirement.preferredSources, ...requirement.fallbackSources] });
        await connection.execute(`INSERT INTO applicant_field_selection_events
          (id,run_id,application_id,applicant_id,field_requirement_id,field_code,selected_evidence_id,field_state,reason,actor_reference,
           evidence_integrity_sha256,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [randomUUID(), runId, resource.applicationId, input.applicantId,
          requirement.requirementId, requirement.fieldCode, resolution.selectedEvidenceId, resolution.state, resolution.reason, actor.id,
          evidenceIntegrityReference(matching), new Date(input.occurredAt)]);
        selectionCount += 1;
      }
      await connection.commit();
      return { runId, applicationId: resource.applicationId, applicantId: input.applicantId, documentId: input.documentId,
        evidenceCount: input.evidence.length, selectionCount, replayed: false };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }

  async #resource(connection: PoolConnection, reference: string, applicantId: number, documentId: number): Promise<{
    applicationId: number; assignedActorId?: string; teamId: number; departmentId: number;
  }> {
    const [rows] = await connection.execute<RowDataPacket[]>(`SELECT a.id applicationId,c.assigned_staff_user_id assignedStaffId,c.team_id teamId,t.department_id departmentId
      FROM applications a JOIN applicants ap ON ap.application_id=a.id AND ap.id=? JOIN documents d ON d.application_id=a.id AND d.applicant_id=ap.id AND d.id=?
      JOIN operations_case_controls c ON c.application_id=a.id JOIN operations_teams t ON t.id=c.team_id WHERE a.reference_number=? FOR UPDATE`,
    [applicantId, documentId, reference]);
    if (!rows[0]) throw new Error("DOCUMENT_INTELLIGENCE_OWNERSHIP_INVALID");
    const assigned = Reflect.get(rows[0], "assignedStaffId");
    return { applicationId: integer(rows[0], "applicationId"), assignedActorId: assigned === null ? undefined : `staff:${integer(rows[0], "assignedStaffId")}`,
      teamId: integer(rows[0], "teamId"), departmentId: integer(rows[0], "departmentId") };
  }
}
