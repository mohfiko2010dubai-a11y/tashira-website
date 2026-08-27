import { describe, expect, it } from "vitest";
import type { ApplicantFieldResolution, AuthorityFieldRequirement } from "./contracts";
import { determineMissingInformation } from "./missing-information";

function requirement(fieldCode: string, fallback: AuthorityFieldRequirement["fallbackSources"]): AuthorityFieldRequirement {
  return { requirementId: `req-${fieldCode}`, authorityCode: "STAGING_TEST", visaRouteCode: "STAGING_TEST_ROUTE", fieldCode,
    fieldLabel: fieldCode, requirement: "REQUIRED", nationalityScopes: [], residenceScopes: [], familyMinorScope: null,
    travelPartyScope: null, preferredSources: ["PASSPORT_MRZ"], fallbackSources: fallback, validationRule: "NON_EMPTY",
    effectiveFrom: "2026-01-01", effectiveTo: null, sourceEvidenceReferences: ["synthetic"], ruleVersionId: "v1", approvalState: "DRAFT" };
}
function resolution(fieldCode: string, state: ApplicantFieldResolution["state"]): ApplicantFieldResolution {
  return { applicationId: 1, applicantId: 10, fieldCode, state, selectedValue: state === "MISSING" || state === "CONFLICTED" ? null : "VALUE",
    selectedEvidenceId: state === "MISSING" || state === "CONFLICTED" ? null : "ev", evidence: [], reason: "TEST", requiresHumanReview: state === "CONFLICTED" };
}

describe("dynamic missing information", () => {
  it("asks only unresolved required fields and routes conflict to Human Review", () => {
    const actions = determineMissingInformation({ applicantId: 10,
      requirements: [requirement("passport_number", []), requirement("profession", ["CUSTOMER_DECLARED"]), requirement("nationality", [])],
      resolutions: [resolution("passport_number", "VERIFIED"), resolution("nationality", "CONFLICTED")] });
    expect(actions).toEqual([
      expect.objectContaining({ fieldCode: "passport_number", state: "AVAILABLE_VERIFIED", action: "NONE" }),
      expect.objectContaining({ fieldCode: "profession", state: "MISSING", action: "DYNAMIC_QUESTION" }),
      expect.objectContaining({ fieldCode: "nationality", state: "CONFLICT", action: "HUMAN_REVIEW" }),
    ]);
  });

  it("rejects a resolution belonging to another family applicant", () => {
    expect(() => determineMissingInformation({ applicantId: 10, requirements: [requirement("nationality", [])],
      resolutions: [{ ...resolution("nationality", "VERIFIED"), applicantId: 11 }] }))
      .toThrow("MISSING_INFORMATION_APPLICANT_SCOPE_MISMATCH");
  });

  it("distinguishes confirmed coverage from extracted values that still need confirmation", () => {
    const actions = determineMissingInformation({
      applicantId: 10,
      requirements: [requirement("confirmed_name", []), requirement("extracted_name", [])],
      resolutions: [resolution("confirmed_name", "CONFIRMED"), resolution("extracted_name", "EXTRACTED")],
    });

    expect(actions).toEqual([
      expect.objectContaining({ fieldCode: "confirmed_name", state: "AVAILABLE_CONFIRMED", action: "NONE" }),
      expect.objectContaining({ fieldCode: "extracted_name", state: "AVAILABLE_EXTRACTED_NEEDS_CONFIRMATION", action: "CUSTOMER_CONFIRMATION" }),
    ]);
  });
});
