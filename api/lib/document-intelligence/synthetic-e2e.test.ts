import { describe, expect, it } from "vitest";
import { resolveApplicantField, type AuthorityFieldRequirement, type ExtractedFieldEvidence, type PassportProfile } from "./contracts";
import { determineMissingInformation } from "./missing-information";
import { PassportProfileRegistry } from "./profile-registry";
import { routeDocumentIntelligence } from "./routing";
import { SyntheticDocumentIntelligenceAdapter, type SyntheticDocumentFixture } from "./synthetic-provider";
import { projectAuthorityTypingFields } from "../operations/typing-pack";

const now = "2026-08-27T12:00:00.000Z";
const profile = (profileId: string, expectedVisibleFields: readonly string[], legitimatelyAbsentFields: readonly string[] = []): PassportProfile => ({
  profileId, version: 1, issuingCountry: "XTS", passportType: "P", layoutVersion: profileId, expectedVisibleFields,
  optionalVisibleFields: [], labelAliases: {}, mrzType: "TD3", expectedMrzFields: ["passport_number"], languages: ["en"],
  nameStructure: "PROFILE_DEFINED", legitimatelyAbsentFields, extractionStrategy: "STAGING_SYNTHETIC_ONLY", validationRules: ["NON_EMPTY"],
  confidenceThreshold: 0.9, sourceEvidenceReferences: ["synthetic-fixture"], effectiveFrom: "2026-01-01", effectiveTo: null,
  lifecycle: "ACTIVE", stagingTestOnly: true,
});
const profiles = [
  profile("STAGING_TEST_PROFILE_A", ["passport_number", "visual_full_name"]),
  profile("STAGING_TEST_PROFILE_B", ["passport_number", "visual_full_name", "father_name"]),
  profile("STAGING_TEST_PROFILE_C", ["passport_number", "visual_full_name"], ["father_name"]),
];
const fixture = (passportProfileId: string, fields: SyntheticDocumentFixture["result"]["fields"]): SyntheticDocumentFixture => ({
  classification: { documentType: "PASSPORT", confidence: 0.99, detectedCountry: "XTS" },
  text: { rawTextReference: `sha256:${passportProfileId}`, confidence: 0.98, pageCount: 1 },
  result: { documentType: "PASSPORT", detectedCountry: "XTS", passportProfileId, passportProfileVersion: 1, fields,
    rawTextReference: `sha256:${passportProfileId}`, confidence: 0.98, warnings: [], mismatches: [], provider: "STAGING_TEST_SYNTHETIC_PROVIDER",
    modelVersion: "v1", processingCost: 0.001, processingCurrency: "USD", escalationReason: null, processingTimestamp: now },
});
const field = (fieldCode: string, value: string, sourceType: "PASSPORT_MRZ" | "PASSPORT_VISUAL", confidence = 0.99) => ({
  fieldCode, value, sourceType, confidence, rawLabel: fieldCode, rawValue: value, boundingReference: `synthetic:${fieldCode}`,
});
const evidence = (applicantId: number, evidenceId: string, fieldCode: string, value: string, sourceType: "PASSPORT_MRZ" | "PASSPORT_VISUAL"): ExtractedFieldEvidence => ({
  evidenceId, applicationId: 1, applicantId, documentId: applicantId, fieldCode, rawValueReference: `sha256:${evidenceId}`,
  extractedValue: value, normalizedValue: value, sourceType, passportProfileId: "STAGING_TEST_PROFILE_A", passportProfileVersion: 1,
  extractionProvider: "STAGING_TEST_SYNTHETIC_PROVIDER", extractionModelVersion: "v1", confidence: 0.99, customerConfirmed: false,
  staffVerified: false, verifiedAt: null, state: "EXTRACTED", extractedAt: now,
});
const requirement = (fieldCode: string): AuthorityFieldRequirement => ({ requirementId: `req-${fieldCode}`, authorityCode: "STAGING_TEST",
  visaRouteCode: "STAGING_TEST_ROUTE", fieldCode, fieldLabel: fieldCode, requirement: "REQUIRED", nationalityScopes: [], residenceScopes: [],
  familyMinorScope: null, travelPartyScope: null, preferredSources: ["PASSPORT_MRZ", "PASSPORT_VISUAL"], fallbackSources: ["CUSTOMER_DECLARED"],
  validationRule: "NON_EMPTY", effectiveFrom: "2026-01-01", effectiveTo: null, sourceEvidenceReferences: ["synthetic"],
  ruleVersionId: "v1", approvalState: "DRAFT" });

describe("synthetic multi-profile Document Intelligence E2E", () => {
  const registry = new PassportProfileRegistry(profiles);
  const adapter = new SyntheticDocumentIntelligenceAdapter({
    a: fixture("STAGING_TEST_PROFILE_A", [field("passport_number", "A100", "PASSPORT_MRZ"), field("visual_full_name", "ALPHA PERSON", "PASSPORT_VISUAL")]),
    b: fixture("STAGING_TEST_PROFILE_B", [field("passport_number", "B200", "PASSPORT_MRZ"), field("visual_full_name", "BETA PERSON", "PASSPORT_VISUAL"), field("father_name", "BETA PARENT", "PASSPORT_VISUAL")]),
  });

  it("keeps clean Profile A on the cheap path and awaits customer confirmation", async () => {
    const detected = registry.detect({ issuingCountry: "XTS", passportType: "P", layoutVersion: "STAGING_TEST_PROFILE_A", evaluatedAt: now, allowStagingTest: true });
    expect(detected.state).toBe("PROFILE_MATCHED");
    expect((await adapter.analyzePassport({ documentReference: "a", mimeType: "image/jpeg", pageCount: 1, passportProfileId: "STAGING_TEST_PROFILE_A" })).fields).toHaveLength(2);
    expect(routeDocumentIntelligence({ hasMachineReadableZone: true, knownPassportProfile: true, ocrConfidence: 0.98, profileConfidenceThreshold: 0.9,
      materialConflict: false, unreadable: false, requiredFieldMissing: false, advancedProviderAvailable: true,
      estimatedCosts: { LOW_COST_OCR: 0.001 } })).toMatchObject({ finalTier: "PROFILE_MAPPING", estimatedCost: 0.001, requiresHumanReview: false });
  });

  it("uses Profile B's evidenced parent field without asking for it again", async () => {
    const analyzed = await adapter.analyzePassport({ documentReference: "b", mimeType: "image/jpeg", pageCount: 1, passportProfileId: "STAGING_TEST_PROFILE_B" });
    expect(analyzed.fields).toContainEqual(expect.objectContaining({ fieldCode: "father_name", value: "BETA PARENT" }));
  });

  it("asks for a required field legitimately absent from Profile C", () => {
    const missing = determineMissingInformation({ applicantId: 3, requirements: [requirement("father_name")], resolutions: [] });
    expect(missing).toEqual([expect.objectContaining({ fieldCode: "father_name", state: "MISSING", action: "DYNAMIC_QUESTION" })]);
  });

  it("preserves conflicting MRZ and visual evidence and blocks Typing Pack", () => {
    const resolution = resolveApplicantField({ applicationId: 1, applicantId: 4, fieldCode: "passport_number",
      evidence: [evidence(4, "mrz", "passport_number", "A100", "PASSPORT_MRZ"), evidence(4, "visual", "passport_number", "A101", "PASSPORT_VISUAL")],
      preferredSources: ["PASSPORT_MRZ", "PASSPORT_VISUAL"] });
    expect(resolution).toMatchObject({ state: "CONFLICTED", selectedValue: null, requiresHumanReview: true });
    expect(resolution.evidence).toHaveLength(2);
    expect(projectAuthorityTypingFields({ applicantId: 4, requirements: [requirement("passport_number")], resolutions: [resolution] }))
      .toMatchObject({ readyForTyping: false, blockingFieldCodes: ["passport_number"] });
  });

  it("routes unknown layouts to Human Review without activating a guessed profile", () => {
    expect(registry.detect({ issuingCountry: "XTS", passportType: "P", layoutVersion: "UNKNOWN", evaluatedAt: now, allowStagingTest: true }))
      .toMatchObject({ state: "UNKNOWN_PASSPORT_LAYOUT", requiresHumanReview: true });
    expect(routeDocumentIntelligence({ hasMachineReadableZone: false, knownPassportProfile: false, ocrConfidence: 0.4, profileConfidenceThreshold: 0.9,
      materialConflict: false, unreadable: false, requiredFieldMissing: true, advancedProviderAvailable: false,
      estimatedCosts: { LOW_COST_OCR: 0.001, HUMAN_REVIEW: 2 } })).toMatchObject({ finalTier: "HUMAN_REVIEW", requiresHumanReview: true });
  });
});
