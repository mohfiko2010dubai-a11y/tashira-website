import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import type { AuthorizationActor } from "../authorization/policy";
import type { AuthorityFieldRequirement, ExtractedFieldEvidence } from "./contracts";
import { MysqlDocumentIntelligenceRepository } from "./mysql-repository";
import type { CanonicalDocumentIntelligenceResult } from "./provider";
import { routeDocumentIntelligence } from "./routing";

const enabled = process.env.RUN_DOCUMENT_INTELLIGENCE_MYSQL_INTEGRATION === "1";

function insertedId(result: object): number {
  const value = Number(Reflect.get(result, "insertId"));
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("SYNTHETIC_INSERT_ID_INVALID");
  return value;
}

describe.skipIf(!enabled)("MySQL document intelligence persistence", () => {
  let pool: Pool;
  let repository: MysqlDocumentIntelligenceRepository;
  let actor: AuthorizationActor;
  let wrongTeamActor: AuthorizationActor;
  let applicationId = 0;
  let applicantId = 0;
  let documentId = 0;
  let requirement: AuthorityFieldRequirement;
  const applicationReference = `DI-${randomUUID().slice(0, 12)}`;

  beforeAll(async () => {
    const uri = process.env.DOCUMENT_INTELLIGENCE_MYSQL_URL;
    if (!uri) throw new Error("DOCUMENT_INTELLIGENCE_MYSQL_URL_REQUIRED");
    pool = createPool({ uri, connectionLimit: 3 });
    repository = new MysqlDocumentIntelligenceRepository(pool);
    const suffix = randomUUID().slice(0, 8);
    const [department] = await pool.execute("INSERT INTO operations_departments (code,name) VALUES (?,?)", [`DI-${suffix}`, "Synthetic Document Intelligence"]);
    const departmentId = insertedId(department);
    const [team] = await pool.execute("INSERT INTO operations_teams (department_id,code,name) VALUES (?,?,?)", [departmentId, `DI-${suffix}`, "Synthetic Document Team"]);
    const teamId = insertedId(team);
    const [application] = await pool.execute(
      "INSERT INTO applications (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status) VALUES (?,'single','non-gcc','ROUTE_DI','regular','synthetic@example.invalid','000',1,100,'documents_received','paid')",
      [applicationReference],
    );
    applicationId = insertedId(application);
    const [applicant] = await pool.execute("INSERT INTO applicants (application_id,applicant_index,full_name,nationality) VALUES (?,0,'Synthetic Applicant','SYNTHETIC')", [applicationId]);
    applicantId = insertedId(applicant);
    const [document] = await pool.execute(
      "INSERT INTO documents (application_id,applicant_id,document_type,original_file_name,stored_file_name,mime_type,file_size,storage_path,upload_status) VALUES (?,?,'passport','synthetic.pdf','synthetic.pdf','application/pdf',10,'synthetic/document-intelligence','uploaded')",
      [applicationId, applicantId],
    );
    documentId = insertedId(document);
    await pool.execute("INSERT INTO operations_case_controls (application_id,version,team_id) VALUES (?,0,?)", [applicationId, teamId]);

    const [source] = await pool.execute("INSERT INTO visa_rule_sources (authority,title,source_url,classification) VALUES ('Synthetic Authority','Synthetic Document Source',?,'OFFICIAL')", [`https://example.invalid/${suffix}`]);
    const snapshotId = randomUUID();
    await pool.execute("INSERT INTO visa_rule_source_snapshots (id,source_id,retrieved_at,fingerprint_sha256,content_reference,retrieval_status) VALUES (?,?,UTC_TIMESTAMP(),REPEAT('d',64),'synthetic-only','SUCCESS')", [snapshotId, insertedId(source)]);
    const [set] = await pool.execute("INSERT INTO visa_rule_sets (stable_id,route_code,profile_code) VALUES (?,'ROUTE_DI','ALL')", [`DI-${suffix}`]);
    const ruleVersionId = randomUUID();
    await pool.execute(`INSERT INTO visa_rule_versions
      (id,rule_set_id,version,status,classification,rule_layer,research_status,source_snapshot_id,effective_from,conditions_json,outcome_json,created_by)
      VALUES (?,?,1,'DRAFT','OFFICIAL','BASE_ROUTE','VALIDATED',?,DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY),JSON_ARRAY(),JSON_OBJECT('eligibility','ELIGIBLE'),'synthetic')`,
    [ruleVersionId, insertedId(set), snapshotId]);
    await pool.execute("INSERT INTO visa_rule_reviews (id,rule_version_id,decision,reviewer_reference,comment) VALUES (?,?,'APPROVED','synthetic','Synthetic governance evidence')", [randomUUID(), ruleVersionId]);
    await pool.execute("UPDATE visa_rule_versions SET status='ACTIVE' WHERE id=?", [ruleVersionId]);
    const requirementId = randomUUID();
    await pool.execute(`INSERT INTO authority_application_field_requirements
      (id,authority_code,visa_route_code,field_code,field_label,requirement_kind,nationality_scopes_json,residence_scopes_json,
       preferred_sources_json,fallback_sources_json,validation_rule,effective_from,source_evidence_json,rule_version_id,approval_state,
       staging_test_only,created_by,created_at) VALUES (?,?,?,?,?,'REQUIRED',JSON_ARRAY(),JSON_ARRAY(),JSON_ARRAY('PASSPORT_MRZ'),
       JSON_ARRAY('PASSPORT_VISUAL'),'NON_EMPTY',DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY),JSON_ARRAY('synthetic-authority-evidence'),?,'ACTIVE',true,'synthetic',UTC_TIMESTAMP(3))`,
    [requirementId, "SYNTHETIC_AUTHORITY", "ROUTE_DI", "passport_number", "Passport number", ruleVersionId]);
    [requirement] = await repository.activeRequirements({ authorityCode: "SYNTHETIC_AUTHORITY", visaRouteCode: "ROUTE_DI", evaluatedAt: new Date(), environment: "STAGING" });
    actor = { id: "staff:document-reviewer", permissions: new Set(["document.review"]), scopes: ["TEAM"], teamIds: new Set([teamId]), departmentIds: new Set() };
    wrongTeamActor = { ...actor, id: "staff:wrong-team", teamIds: new Set([teamId + 10_000]) };
  });

  afterAll(async () => { await pool?.end(); });

  it("loads synthetic governed fields only outside Production", async () => {
    expect(requirement).toMatchObject({ fieldCode: "passport_number", approvalState: "ACTIVE" });
    expect(await repository.activeRequirements({ authorityCode: "SYNTHETIC_AUTHORITY", visaRouteCode: "ROUTE_DI", evaluatedAt: new Date(), environment: "PRODUCTION" })).toEqual([]);
  });

  it("persists immutable applicant-scoped evidence and restart-safe idempotency", async () => {
    const occurredAt = new Date().toISOString();
    const evidence: ExtractedFieldEvidence = { evidenceId: randomUUID(), applicationId, applicantId, documentId,
      fieldCode: "passport_number", rawValueReference: "secure:synthetic/raw/1", extractedValue: "SYNTHETIC123",
      normalizedValue: "SYNTHETIC123", sourceType: "PASSPORT_MRZ", passportProfileId: null, passportProfileVersion: null,
      extractionProvider: "synthetic", extractionModelVersion: "v1", confidence: 0.99, customerConfirmed: false,
      staffVerified: false, verifiedAt: null, state: "EXTRACTED", extractedAt: occurredAt };
    const providerResult: CanonicalDocumentIntelligenceResult = { documentType: "PASSPORT", detectedCountry: null,
      passportProfileId: null, passportProfileVersion: null, fields: [{ fieldCode: "passport_number", value: "SYNTHETIC123", sourceType: "PASSPORT_MRZ", confidence: 0.99 }],
      rawTextReference: "secure:synthetic/raw/1", confidence: 0.99, warnings: [], mismatches: [], provider: "synthetic",
      modelVersion: "v1", processingCost: 0.01, processingCurrency: "USD", escalationReason: null, processingTimestamp: occurredAt };
    const routing = routeDocumentIntelligence({ hasMachineReadableZone: true, knownPassportProfile: false, ocrConfidence: 0.99,
      profileConfidenceThreshold: 0.9, materialConflict: false, unreadable: false, requiredFieldMissing: false,
      advancedProviderAvailable: true, estimatedCosts: { LOW_COST_OCR: 0.01 } });
    const input = { requestKey: `request-${randomUUID()}`, applicationReference, applicantId, documentId, passportProfileId: null,
      providerResult, routing, pageCount: 1, callCount: 1, evidence: [evidence], requirements: [requirement], occurredAt };
    const created = await repository.persist(input, actor);
    expect(created).toMatchObject({ applicationId, applicantId, documentId, evidenceCount: 1, selectionCount: 1, replayed: false });
    expect(await repository.persist(input, actor)).toMatchObject({ runId: created.runId, evidenceCount: 1, selectionCount: 1, replayed: true });
    await expect(repository.persist({ ...input, pageCount: 2 }, actor)).rejects.toThrow("DOCUMENT_INTELLIGENCE_IDEMPOTENCY_CONFLICT");
    const [rows] = await pool.execute("SELECT processing_tiers_json tiers FROM document_intelligence_runs WHERE id=?", [created.runId]);
    const storedTiers: unknown = Reflect.get((rows as object[])[0], "tiers");
    expect(typeof storedTiers === "string" ? JSON.parse(storedTiers) : storedTiers).toEqual(routing.tiers);
    const operationalView = await repository.readApplicant(applicationReference, applicantId, actor);
    expect(operationalView.runs[0]).not.toHaveProperty("processingCost");
    expect(operationalView.fields[0]).toMatchObject({ runId: created.runId, fieldCode: "passport_number", selectedValue: "SYNTHETIC123" });
    const financeView = await repository.readApplicant(applicationReference, applicantId,
      { ...actor, permissions: new Set([...actor.permissions, "supplier.read_financial"]) });
    expect(financeView.runs[0]).toMatchObject({ processingCost: "0.010000", currency: "USD" });
    await expect(repository.readApplicant(applicationReference, applicantId, wrongTeamActor)).rejects.toThrow("DOCUMENT_INTELLIGENCE_ACCESS_DENIED");
  });

  it("fails closed for wrong-team and cross-applicant evidence", async () => {
    const occurredAt = new Date().toISOString();
    const providerResult: CanonicalDocumentIntelligenceResult = { documentType: "PASSPORT", detectedCountry: null, passportProfileId: null,
      passportProfileVersion: null, fields: [], rawTextReference: null, confidence: 0.9, warnings: [], mismatches: [], provider: "synthetic",
      modelVersion: "v1", processingCost: 0, processingCurrency: "USD", escalationReason: null, processingTimestamp: occurredAt };
    const routing = routeDocumentIntelligence({ hasMachineReadableZone: false, knownPassportProfile: false, ocrConfidence: 0.9,
      profileConfidenceThreshold: 0.9, materialConflict: false, unreadable: false, requiredFieldMissing: false,
      advancedProviderAvailable: true, estimatedCosts: {} });
    const base = { requestKey: `denied-${randomUUID()}`, applicationReference, applicantId, documentId, passportProfileId: null,
      providerResult, routing, pageCount: 1, callCount: 1, evidence: [], requirements: [requirement], occurredAt };
    await expect(repository.persist(base, wrongTeamActor)).rejects.toThrow("DOCUMENT_INTELLIGENCE_ACCESS_DENIED");
    const foreignEvidence: ExtractedFieldEvidence = { evidenceId: randomUUID(), applicationId, applicantId: applicantId + 1, documentId,
      fieldCode: "passport_number", rawValueReference: "secure:synthetic/raw/foreign", extractedValue: "X", normalizedValue: "X",
      sourceType: "PASSPORT_VISUAL", passportProfileId: null, passportProfileVersion: null, extractionProvider: "synthetic",
      extractionModelVersion: "v1", confidence: 0.8, customerConfirmed: false, staffVerified: false, verifiedAt: null,
      state: "EXTRACTED", extractedAt: occurredAt };
    await expect(repository.persist({ ...base, requestKey: `foreign-${randomUUID()}`, evidence: [foreignEvidence] }, actor))
      .rejects.toThrow("DOCUMENT_INTELLIGENCE_EVIDENCE_OWNERSHIP_INVALID");
  });
});
