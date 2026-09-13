import { createHash } from "node:crypto";
import { OWNER_DOCUMENTS, OWNER_DOCUMENT_VERSION } from "../../../contracts/owner-document-requirements";
import { type EligibilityEvaluationResult, type EligibilityProfile } from "../eligibility/eligibility-engine";
import { requiredDocuments, tripPurposeSchema } from "../../../contracts/document-requirement-engine";
import type { VersionedRequirementCatalog } from "../requirements/requirement-catalog";

const existingDefinitionIds: Record<string, number> = {"PASSPORT": 12, "PERSONAL_PHOTO": 13, "RETURN_TICKET": 22, "UAE_ACCOMMODATION": 23, "HOST_DETAILS": 24, "ONWARD_TICKET": 25, "HOME_NATIONAL_ID": 26, "ADDITIONAL_PASSPORT_PAGES": 27, "KSA_IQAMA_FRONT": 28, "KSA_IQAMA_BACK": 29, "SA_RESIDENCE_PROOF": 30, "SA_ABSHER_REPORT": 31, "KWT_IQAMA_FRONT": 32, "KWT_IQAMA_BACK": 33, "KW_MOBILE_ID": 34, "BH_RESIDENCE_REPORT": 35, "QA_RESIDENCE_CARD": 36, "OMN_ID_CARD": 37};

export function withOwnerDocumentCatalog(catalog: VersionedRequirementCatalog): VersionedRequirementCatalog {
  const requirements = OWNER_DOCUMENTS.filter(document => document.status === "approved").map(document => ({
    kind: "DOCUMENT" as const, definitionId: `09feb153-2026-4911-8000-${String(existingDefinitionIds[document.code] ?? (parseInt(createHash("sha256").update(document.code).digest("hex").slice(0, 9), 16) + 100)).padStart(12, "0")}`,
    code: document.code, version: 1, status: "ACTIVE" as const, reviewStatus: "APPROVED" as const,
    customerLabel: document.en, shortCustomerExplanation: document.hintEn, internalLabel: document.en,
    classification: "OPERATIONAL" as const, authoritySemantics: null, reasonTemplate: "Requested by TASHIRA for application processing.",
    effectiveFrom: new Date("2026-09-11T00:00:00Z"), effectiveTo: null, documentType: document.type,
    category: "SUPPORTING" as const, requiredCapability: true, conditionalCapability: false, sharedDocumentCapability: false,
    applicantScopedCapability: true, travelGroupScopedCapability: false, familyScopedCapability: false,
    aiExtractionCapability: false, humanReviewPolicy: "ALWAYS" as const,
  })).filter(document => !catalog.requirements.some(existing => existing.code === document.code));
  return { ...catalog, catalogVersion: catalog.catalogVersion.endsWith(OWNER_DOCUMENT_VERSION) ? catalog.catalogVersion : `${catalog.catalogVersion}:${OWNER_DOCUMENT_VERSION}`, requirements: [...catalog.requirements, ...requirements] };
}

/** Processing documents never grant immigration eligibility or publish drafts. */
export function applyOwnerDocumentRequirements(result: EligibilityEvaluationResult, profile: EligibilityProfile, evaluatedAt: Date): EligibilityEvaluationResult {
  void evaluatedAt;
  const rules = requiredDocuments({ nationality: String(profile.attributes.nationality ?? ""),
    country_of_residence: String(profile.attributes.residenceCountry ?? ""), visa_type: profile.routeCode,
    trip_purpose: tripPurposeSchema.safeParse(profile.attributes.tripPurpose).data });
  const requiredCodes = rules.map(rule => rule.code);
  return { ...result, requiredDocuments: requiredCodes, conditionalDocuments: [],
    reason: `${result.reason} Processing checklist ${OWNER_DOCUMENT_VERSION}: ${requiredCodes.join(", ")}.` };
}
