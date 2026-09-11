import { OWNER_DOCUMENTS, OWNER_DOCUMENT_VERSION } from "../../../contracts/owner-document-requirements";
import type { EligibilityRule } from "../eligibility/eligibility-engine";
import type { VersionedRequirementCatalog } from "../requirements/requirement-catalog";

export function withOwnerDocumentCatalog(catalog: VersionedRequirementCatalog): VersionedRequirementCatalog {
  const requirements = OWNER_DOCUMENTS.map((document, index) => ({
    kind: "DOCUMENT" as const, definitionId: `09feb153-2026-4911-8000-${String(index + 1).padStart(12, "0")}`,
    code: document.code, version: 1, status: "ACTIVE" as const, reviewStatus: "APPROVED" as const,
    customerLabel: document.en, shortCustomerExplanation: document.en, internalLabel: document.en,
    classification: "OPERATIONAL" as const, authoritySemantics: null, reasonTemplate: "Requested by TASHIRA for application processing.",
    effectiveFrom: new Date("2026-09-11T00:00:00Z"), effectiveTo: null, documentType: document.type,
    category: "SUPPORTING" as const, requiredCapability: true, conditionalCapability: false, sharedDocumentCapability: false,
    applicantScopedCapability: true, travelGroupScopedCapability: false, familyScopedCapability: false,
    aiExtractionCapability: false, humanReviewPolicy: "ALWAYS" as const,
  })).filter(document => !catalog.requirements.some(existing => existing.code === document.code));
  return { ...catalog, catalogVersion: catalog.catalogVersion.endsWith(OWNER_DOCUMENT_VERSION) ? catalog.catalogVersion : `${catalog.catalogVersion}:${OWNER_DOCUMENT_VERSION}`, requirements: [...catalog.requirements, ...requirements] };
}

export function ownerDocumentRules(routeCode: string): EligibilityRule[] {
  const make = (id: string, field: string, values: string[], requiredDocuments: string[]): EligibilityRule => ({
    id: `TASHIRA_OWNER_DOC_${id}`, version: 1, routeCode, layer: "OPERATIONAL_OVERLAY", classification: "OPERATIONAL",
    sourceAuthority: "TASHIRA owner document instructions, 2026-09-11", reason: "TASHIRA processing documents; not an immigration eligibility decision.",
    effectiveFrom: new Date("2026-09-11T00:00:00Z"), effectiveTo: null,
    conditions: [{ field, operator: "IN", value: values }], eligibilityEffect: "NO_CHANGE", requiredDocuments, conditionalDocuments: [],
  });
  return [make("PK_PASSPORT", "nationality", ["PK"], ["PASSPORT_SECOND_PAGE"]),
    make("IN_SY_PASSPORT", "nationality", ["IN", "SY"], ["PASSPORT_LAST_PAGE"]),
    make("HOME_ID", "nationality", ["PK", "IQ", "IR", "AF"], ["HOME_NATIONAL_ID"]),
    make("SA", "gccCountry", ["SA"], ["RESIDENCE_CARD_FRONT", "RESIDENCE_CARD_BACK", "SA_RESIDENCE_PROOF", "SA_ABSHER_REPORT"]),
    make("KW", "gccCountry", ["KW"], ["RESIDENCE_CARD_FRONT", "RESIDENCE_CARD_BACK", "KW_MOBILE_ID"]),
    make("BH", "gccCountry", ["BH"], ["BH_RESIDENCE_REPORT"]),
    make("QA", "gccCountry", ["QA"], ["QA_RESIDENCE_CARD"]),
  ];
}
