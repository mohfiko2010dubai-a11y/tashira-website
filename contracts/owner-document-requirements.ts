import { DOCUMENT_REQUIREMENT_RULES, requiredDocuments, type TripPurpose } from "./document-requirement-engine";

export const OWNER_DOCUMENT_VERSION = "tashira-owner-documents-20260913-v4";
/** All customer, server and payment callers use the same approved rule union. */
export function ownerRequiredDocumentCodes(nationality: string | null | undefined, country: string | null | undefined, visaType: string, tripPurpose?: TripPurpose | null): string[] {
  return requiredDocuments({ nationality, country_of_residence: country, visa_type: visaType, trip_purpose: tripPurpose }).map(rule => rule.code);
}
export const OWNER_DOCUMENTS = DOCUMENT_REQUIREMENT_RULES.map(rule => ({
  code: rule.code, en: rule.label_en, ar: rule.label_ar, type: rule.document_type,
  hintEn: rule.hint_en, hintAr: rule.hint_ar, status: rule.status, key: rule.key, rule,
}));
