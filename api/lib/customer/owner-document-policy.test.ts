import { describe, expect, it } from "vitest";
import { applyOwnerDocumentRequirements, withOwnerDocumentCatalog } from "./owner-document-policy";
import { evaluateEligibility, type EligibilityRule } from "../eligibility/eligibility-engine";
import { requirementDefinitionSchema } from "../requirements/requirement-catalog";
import { customerFormRules } from "./customer-form-rules";
import { ownerRequiredDocumentCodes, OWNER_DOCUMENT_VERSION } from "../../../contracts/owner-document-requirements";
import { DOCUMENT_REQUIREMENT_RULES } from "../../../contracts/document-requirement-engine";

describe("Approved owner document rules", () => {
  it("uses the same approved union for payment and interview projection across countries", () => {
    for (const nationality of ["EG", "PK", "IN", "SY", "IR", "IQ", "AF"]) {
      for (const residenceCountry of ["SA", "KW", "BH", "QA", "OM", "EG"]) {
        const profile = { routeCode: "30days", attributes: { nationality, residenceCountry } };
        const at = new Date("2026-09-13");
        const original = evaluateEligibility({ profile, evaluatedAt: at, rules: [] });
        const result = applyOwnerDocumentRequirements(original, profile, at);
        expect(result.requiredDocuments).toEqual(ownerRequiredDocumentCodes(nationality, residenceCountry, "30days"));
        expect(result.requiredDocuments.includes("HOME_NATIONAL_ID")).toBe(["PK", "IQ", "IR", "AF"].includes(nationality));
        expect(result.requiredDocuments).not.toContain("PASSPORT_SECOND_PAGE");
        expect(result.matchedRules).toEqual(original.matchedRules);
        expect(result.finalEligibilityState).toBe(original.finalEligibilityState);
        expect(result.reason).toContain(OWNER_DOCUMENT_VERSION);
      }
    }
  });
  it("publishes valid applicant-scoped definitions for approved rows only", () => {
    const catalog = withOwnerDocumentCatalog({ catalogVersion: "test", requirements: [], questions: [] });
    for (const definition of catalog.requirements) expect(requirementDefinitionSchema.safeParse(definition).success).toBe(true);
    for (const rule of DOCUMENT_REQUIREMENT_RULES) expect(catalog.requirements.some(item => item.code === rule.code)).toBe(rule.status === "approved");
    expect(withOwnerDocumentCatalog(catalog)).toEqual(catalog);
  });
  it("removes only named demo overlays and preserves official rules", () => {
    const official: EligibilityRule = { id: "OFFICIAL_PK", version: 1, routeCode: "TEST", classification: "OFFICIAL", layer: "BASE_ROUTE",
      sourceAuthority: "Test authority", reason: "Test", effectiveFrom: new Date("2026-01-01"), effectiveTo: null,
      conditions: [], eligibilityEffect: "NO_CHANGE", requiredDocuments: [], conditionalDocuments: [] };
    const demo = { ...official, id: "STAGING_TEST_ROUTE_TEST_PK" };
    expect(customerFormRules([official, demo])).toEqual([official]);
  });
});
