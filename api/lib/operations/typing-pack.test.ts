import { describe, expect, it } from "vitest";
import { generateTypingPack, projectAuthorityTypingFields } from "./typing-pack";
import type { AuthorityFieldRequirement, ExtractedFieldEvidence } from "../document-intelligence/contracts";

const base = { packId: "pack-1", applicationId: 1, applicantId: 2, templateId: "OWNER_APPROVED_TEMPLATE", templateVersion: 1, generatedAt: "2026-08-25T12:00:00Z", fields: [{ key: "passportNumber", label: "Passport number", source: "APPLICANT" as const, value: "SYNTHETIC" }], evidenceReferences: ["evaluation:1"] };
describe("typing pack", () => {
  it("creates an integrity-bound draft and marks authoritative applicant fields for human verification", () => { const pack = generateTypingPack(base); expect(pack.state).toBe("DRAFT_REQUIRES_HUMAN_REVIEW"); expect(pack.integritySha256).toMatch(/^[a-f0-9]{64}$/); expect(pack.humanVerificationFieldKeys).toEqual(["passportNumber"]); });
  it("does not require human verification for an application identity reference", () => expect(generateTypingPack({ ...base,
    fields: [{ key: "application.referenceNumber", label: "Reference", source: "APPLICATION", value: "TSH-TEST" }] }).humanVerificationFieldKeys).toEqual([]));
  it.each(["cvc", "payment.card_number", "stripe_secret", "storage.path", "document_contents"])("rejects sensitive nested key %s", (key) => expect(() => generateTypingPack({ ...base, fields: [{ ...base.fields[0], key }] })).toThrow("TYPING_PACK_FIELD_PROHIBITED"));
  it("rejects duplicate field identities instead of resolving them silently", () => expect(() => generateTypingPack({ ...base,
    fields: [base.fields[0], { ...base.fields[0], value: "CONFLICTING" }] })).toThrow("TYPING_PACK_FIELD_DUPLICATE"));
  it.each([{ label: "Passport\nnumber", value: "SYNTHETIC" }, { label: "Passport number", value: "SYNTHETIC\u0000INJECTED" }])("rejects control characters in authority output", (field) => expect(() => generateTypingPack({ ...base,
      fields: [{ ...base.fields[0], ...field }] })).toThrow("TYPING_PACK_FIELD_PROHIBITED"));
});

describe("Typing Pack authority field readiness", () => {
  const requirement = (fieldCode: string): AuthorityFieldRequirement => ({ requirementId: `r-${fieldCode}`, authorityCode: "STAGING_TEST",
    visaRouteCode: "STAGING_ROUTE", fieldCode, fieldLabel: fieldCode, requirement: "REQUIRED", nationalityScopes: [], residenceScopes: [],
    familyMinorScope: null, travelPartyScope: null, preferredSources: ["PASSPORT_MRZ"], fallbackSources: ["CUSTOMER_DECLARED"],
    validationRule: "NON_EMPTY", effectiveFrom: "2026-01-01", effectiveTo: null, sourceEvidenceReferences: ["synthetic"],
    ruleVersionId: "v1", approvalState: "DRAFT" });
  const evidence: ExtractedFieldEvidence = { evidenceId: "ev-1", applicationId: 1, applicantId: 10, documentId: 1,
    fieldCode: "passport_number", rawValueReference: "sha256:synthetic", extractedValue: "A123", normalizedValue: "A123",
    sourceType: "PASSPORT_MRZ", passportProfileId: "p", passportProfileVersion: 1, extractionProvider: "SYNTHETIC",
    extractionModelVersion: "v1", confidence: 0.99, customerConfirmed: false, staffVerified: true,
    verifiedAt: "2026-08-27", state: "VERIFIED", extractedAt: "2026-08-27" };

  it("blocks READY_FOR_TYPING for missing/conflicted required authority fields without changing legacy pack hashes", () => {
    const result = projectAuthorityTypingFields({ applicantId: 10, requirements: [requirement("passport_number"), requirement("profession")],
      resolutions: [{ applicationId: 1, applicantId: 10, fieldCode: "passport_number", state: "VERIFIED", selectedValue: "A123",
        selectedEvidenceId: "ev-1", evidence: [evidence], reason: "SELECTED_PASSPORT_MRZ", requiresHumanReview: false }] });
    expect(result).toMatchObject({ readyForTyping: false, blockingFieldCodes: ["profession"] });
    expect(result.fields).toEqual([
      expect.objectContaining({ fieldCode: "passport_number", status: "VERIFIED", sourceEvidenceId: "ev-1", blocking: false }),
      expect.objectContaining({ fieldCode: "profession", status: "MISSING", value: null, blocking: true, reason: "MISSING_REQUIRED_AUTHORITY_FIELD" }),
    ]);
  });

  it("rejects cross-applicant field readiness", () => {
    expect(() => projectAuthorityTypingFields({ applicantId: 10, requirements: [requirement("passport_number")],
      resolutions: [{ applicationId: 1, applicantId: 11, fieldCode: "passport_number", state: "VERIFIED", selectedValue: "A123",
        selectedEvidenceId: "ev-1", evidence: [evidence], reason: "TEST", requiresHumanReview: false }] }))
      .toThrow("TYPING_PACK_AUTHORITY_APPLICANT_SCOPE_MISMATCH");
  });
});
