import { describe, expect, it } from "vitest";
import { evidenceIntegrityReference, resolveApplicantField, validateAuthorityFieldRequirement, validatePassportProfile,
  type AuthorityFieldRequirement, type ExtractedFieldEvidence, type PassportProfile } from "./contracts";

const requirement: AuthorityFieldRequirement = {
  requirementId: "afr-1", authorityCode: "STAGING_TEST_AUTHORITY", visaRouteCode: "STAGING_TEST_ROUTE", fieldCode: "passport_number",
  fieldLabel: "Passport number", requirement: "REQUIRED", nationalityScopes: [], residenceScopes: [], familyMinorScope: null,
  travelPartyScope: null, preferredSources: ["PASSPORT_MRZ", "PASSPORT_VISUAL"], fallbackSources: ["CUSTOMER_DECLARED"],
  validationRule: "NON_EMPTY", effectiveFrom: "2026-01-01T00:00:00Z", effectiveTo: null,
  sourceEvidenceReferences: ["staging-test-evidence-1"], ruleVersionId: "rule-v1", approvalState: "DRAFT",
};
const profile: PassportProfile = {
  profileId: "STAGING_TEST_EGYPT_TD3_V1", version: 1, issuingCountry: "EGY", passportType: "P", layoutVersion: "synthetic-v1",
  expectedVisibleFields: ["passport_number", "passport_visual_full_name"], optionalVisibleFields: [], labelAliases: {}, mrzType: "TD3",
  expectedMrzFields: ["passport_number", "nationality", "date_of_birth", "expiry_date"], languages: ["ar", "en"],
  nameStructure: "SURNAME_GIVEN_NAMES", legitimatelyAbsentFields: [], extractionStrategy: "MRZ_THEN_VISUAL",
  validationRules: ["MRZ_CHECK_DIGITS"], confidenceThreshold: 0.9, sourceEvidenceReferences: ["synthetic-test-spec"],
  effectiveFrom: "2026-01-01T00:00:00Z", effectiveTo: null, lifecycle: "DRAFT", stagingTestOnly: true,
};
function evidence(overrides: Partial<ExtractedFieldEvidence> = {}): ExtractedFieldEvidence {
  return { evidenceId: "ev-1", applicationId: 1, applicantId: 10, documentId: 100, fieldCode: "passport_number",
    rawValueReference: "sha256:synthetic", extractedValue: "A1234567", normalizedValue: "A1234567", sourceType: "PASSPORT_MRZ",
    passportProfileId: profile.profileId, passportProfileVersion: 1, extractionProvider: "SYNTHETIC", extractionModelVersion: "v1",
    confidence: 0.99, customerConfirmed: false, staffVerified: false, verifiedAt: null, state: "EXTRACTED",
    extractedAt: "2026-08-27T00:00:00Z", ...overrides };
}

describe("document intelligence governed contracts", () => {
  it("validates governed authority requirements and rejects ambiguous source hierarchies", () => {
    expect(validateAuthorityFieldRequirement(requirement)).toEqual(requirement);
    expect(() => validateAuthorityFieldRequirement({ ...requirement, fallbackSources: ["PASSPORT_MRZ"] }))
      .toThrow("AUTHORITY_FIELD_SOURCE_HIERARCHY_OVERLAP");
    expect(() => validateAuthorityFieldRequirement({ ...requirement, sourceEvidenceReferences: [] }))
      .toThrow("AUTHORITY_FIELD_GOVERNANCE_EVIDENCE_REQUIRED");
  });

  it("validates profile governance evidence and rejects unsafe confidence", () => {
    expect(validatePassportProfile(profile)).toEqual(profile);
    expect(() => validatePassportProfile({ ...profile, confidenceThreshold: 1.1 })).toThrow("PASSPORT_PROFILE_CONFIDENCE_INVALID");
  });

  it("selects verified evidence deterministically without erasing raw extraction", () => {
    const extracted = evidence();
    const verified = evidence({ evidenceId: "ev-2", sourceType: "PASSPORT_VISUAL", staffVerified: true,
      verifiedAt: "2026-08-27T01:00:00Z", state: "VERIFIED" });
    const result = resolveApplicantField({ applicationId: 1, applicantId: 10, fieldCode: "passport_number",
      evidence: [extracted, verified], preferredSources: requirement.preferredSources });
    expect(result).toMatchObject({ state: "VERIFIED", selectedEvidenceId: "ev-2", selectedValue: "A1234567", requiresHumanReview: false });
    expect(result.evidence).toHaveLength(2);
  });

  it("fails closed on MRZ/visual conflict and preserves both evidence records", () => {
    const result = resolveApplicantField({ applicationId: 1, applicantId: 10, fieldCode: "passport_number",
      evidence: [evidence(), evidence({ evidenceId: "ev-visual", sourceType: "PASSPORT_VISUAL", extractedValue: "B7654321", normalizedValue: "B7654321" })],
      preferredSources: requirement.preferredSources });
    expect(result).toMatchObject({ state: "CONFLICTED", reason: "IDENTITY_DATA_CONFLICT", selectedValue: null, requiresHumanReview: true });
    expect(result.evidence).toHaveLength(2);
  });

  it("rejects cross-applicant evidence rather than leaking family identity", () => {
    expect(() => resolveApplicantField({ applicationId: 1, applicantId: 10, fieldCode: "passport_number",
      evidence: [evidence({ applicantId: 11 })], preferredSources: requirement.preferredSources }))
      .toThrow("FIELD_EVIDENCE_OWNERSHIP_SCOPE_MISMATCH");
  });

  it("creates stable integrity evidence independent of input ordering", () => {
    const first = evidence(); const second = evidence({ evidenceId: "ev-2" });
    expect(evidenceIntegrityReference([first, second])).toBe(evidenceIntegrityReference([second, first]));
  });
});
