import { describe, expect, it } from "vitest";
import { customerReason, isDefinitionEffective, resolveHistoricalRequirement, type VersionedRequirementCatalog } from "./requirement-catalog";
import { buildGenericCatalogSeed, GENERIC_QUESTION_CODES, GENERIC_REQUIREMENT_CODES, validateCatalogImport } from "./requirement-catalog-seed";

const definition = {
  kind: "DOCUMENT" as const, definitionId: "00000000-0000-4000-8000-000000000001", code: "PASSPORT", version: 1,
  status: "ACTIVE" as const, documentType: "PASSPORT", customerLabel: "Passport copy", shortCustomerExplanation: "Upload a clear passport copy.",
  internalLabel: "Passport", classification: "OFFICIAL" as const, authoritySemantics: "Relevant visa authority",
  reasonTemplate: "Required by the relevant authority for this visa route.", category: "IDENTITY" as const,
  requiredCapability: true, conditionalCapability: false, sharedDocumentCapability: false, applicantScopedCapability: true,
  travelGroupScopedCapability: false, familyScopedCapability: false, aiExtractionCapability: true,
  humanReviewPolicy: "ON_WARNING" as const, effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveTo: null,
  reviewStatus: "APPROVED" as const,
};
const catalog: VersionedRequirementCatalog = { catalogVersion: "v1", requirements: [definition], questions: [] };

describe("versioned requirement catalog", () => {
  it("uses inclusive effective dates and preserves customer classification wording", () => {
    expect(isDefinitionEffective({ ...definition, effectiveTo: new Date("2026-12-31T00:00:00Z") }, new Date("2026-12-31T00:00:00Z"))).toBe(true);
    expect(customerReason(definition)).toBe("Required by the relevant authority for this visa route.");
    expect(customerReason({ ...definition, classification: "OPERATIONAL" })).toBe("Required for TASHIRA processing.");
    expect(() => customerReason({ ...definition, classification: "INTERNAL" })).toThrow("INTERNAL_REQUIREMENT_NOT_CUSTOMER_VISIBLE");
  });

  it("does not fabricate historical labels when the exact catalog version is absent", () => {
    expect(resolveHistoricalRequirement({ definitionId: definition.definitionId, definitionVersion: 1, requirementCode: "PASSPORT" }, catalog)).toEqual(definition);
    expect(resolveHistoricalRequirement({ definitionId: null, definitionVersion: null, requirementCode: "OLD_RAW_CODE" }, catalog))
      .toEqual({ code: "OLD_RAW_CODE", customerLabel: "LEGACY_REQUIREMENT" });
  });

  it("provides deterministic generic import codes without activating requirements", () => {
    expect(GENERIC_REQUIREMENT_CODES).toContain("FAMILY_BOOKING");
    expect(GENERIC_QUESTION_CODES).toContain("GCC_RESIDENT");
    const first = validateCatalogImport({ importVersion: "generic-v1", requirements: [definition], questions: [] });
    const second = validateCatalogImport({ questions: [], requirements: [definition], importVersion: "generic-v1" });
    expect(first.sha256).toBe(second.sha256);
    expect(first.catalog.requirements[0].status).toBe("ACTIVE");
    const generic = buildGenericCatalogSeed();
    expect(generic.requirements).toHaveLength(12);
    expect(generic.questions).toHaveLength(12);
    expect(generic.requirements.every(({ status }) => status === "DRAFT")).toBe(true);
  });
});
