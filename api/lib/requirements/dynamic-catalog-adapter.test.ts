import { describe, expect, it } from "vitest";
import type { VersionedRequirementCatalog } from "./requirement-catalog";
import { toDynamicRequirementCatalog } from "./dynamic-catalog-adapter";

const base = {
  definitionId: "00000000-0000-4000-8000-000000000001", version: 1, status: "ACTIVE" as const,
  customerLabel: "Passport", shortCustomerExplanation: "Upload a clear copy.", internalLabel: "Passport",
  authoritySemantics: "Authority", reasonTemplate: "Required by the relevant authority for this visa route.",
  effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveTo: null, reviewStatus: "APPROVED" as const,
};

describe("dynamic catalog adapter", () => {
  it("projects governed metadata and excludes internal definitions", () => {
    const catalog: VersionedRequirementCatalog = {
      catalogVersion: "v1",
      requirements: [
        { ...base, kind: "DOCUMENT", code: "PASSPORT", classification: "OFFICIAL", documentType: "PASSPORT", category: "IDENTITY",
          requiredCapability: true, conditionalCapability: false, sharedDocumentCapability: false, applicantScopedCapability: true,
          travelGroupScopedCapability: false, familyScopedCapability: false, aiExtractionCapability: true, humanReviewPolicy: "ON_WARNING" },
        { ...base, definitionId: "00000000-0000-4000-8000-000000000002", kind: "DOCUMENT", code: "INTERNAL_NOTE", classification: "INTERNAL", documentType: "NOTE", category: "SUPPORTING",
          requiredCapability: false, conditionalCapability: true, sharedDocumentCapability: false, applicantScopedCapability: true,
          travelGroupScopedCapability: false, familyScopedCapability: false, aiExtractionCapability: false, humanReviewPolicy: "ALWAYS" },
        { ...base, definitionId: "00000000-0000-4000-8000-000000000003", kind: "DOCUMENT", code: "OPTIONAL_TICKET", classification: "OPTIONAL", documentType: "TICKET", category: "TRAVEL",
          requiredCapability: false, conditionalCapability: true, sharedDocumentCapability: true, applicantScopedCapability: true,
          travelGroupScopedCapability: true, familyScopedCapability: false, aiExtractionCapability: false, humanReviewPolicy: "ON_WARNING" },
      ],
      questions: [],
    };
    expect(toDynamicRequirementCatalog(catalog).documents).toEqual([expect.objectContaining({
      code: "PASSPORT", definitionVersion: 1, classification: "AUTHORITY_REQUIRED",
      reasonTemplate: "Required by the relevant authority for this visa route.",
    }), expect.objectContaining({ code: "OPTIONAL_TICKET", classification: "OPTIONAL",
      reasonTemplate: "Optional supporting evidence; it is not required for this application." })]);
  });
});
