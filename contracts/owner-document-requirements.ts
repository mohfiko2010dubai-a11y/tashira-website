/** Owner instructions supplied 2026-09-11 in the two Document Requirements Summary PDFs. */
export const OWNER_DOCUMENT_VERSION = "tashira-owner-documents-20260911-v1";
/** Complete payment checklist for the new owner form, independent of eligibility catalogs. */
export function ownerRequiredDocumentCodes(nationality: string | null | undefined, country: string | null | undefined, residenceType: string): string[] {
  const codes = ["PASSPORT", "PERSONAL_PHOTO"];
  if (nationality === "PK") codes.push("PASSPORT_SECOND_PAGE");
  if (nationality === "IN" || nationality === "SY") codes.push("PASSPORT_LAST_PAGE");
  if (["PK", "IQ", "IR", "AF"].includes(nationality ?? "")) codes.push("HOME_NATIONAL_ID");
  if (residenceType === "gcc-resident" || residenceType === "gcc-accompany") {
    const residence: Record<string, string[]> = {
      SA: ["RESIDENCE_CARD_FRONT", "RESIDENCE_CARD_BACK", "SA_RESIDENCE_PROOF", "SA_ABSHER_REPORT"],
      KW: ["RESIDENCE_CARD_FRONT", "RESIDENCE_CARD_BACK", "KW_MOBILE_ID"],
      BH: ["BH_RESIDENCE_REPORT"], QA: ["QA_RESIDENCE_CARD"], AE: ["GCC_RESIDENCE"], OM: ["GCC_RESIDENCE"],
    };
    codes.push(...(residence[country ?? ""] ?? []));
  }
  return codes;
}
export const OWNER_DOCUMENTS = [
  { code: "PASSPORT_SECOND_PAGE", en: "Passport — second page", ar: "جواز السفر — الصفحة الثانية", type: "PASSPORT" },
  { code: "PASSPORT_LAST_PAGE", en: "Passport — last page", ar: "جواز السفر — الصفحة الأخيرة", type: "PASSPORT" },
  { code: "HOME_NATIONAL_ID", en: "National ID issued by your home country", ar: "بطاقة الهوية الوطنية الصادرة من البلد الأم", type: "NATIONAL_ID" },
  { code: "RESIDENCE_CARD_FRONT", en: "Residence card — front", ar: "بطاقة الإقامة — الوجه الأمامي", type: "GCC_RESIDENCE" },
  { code: "RESIDENCE_CARD_BACK", en: "Residence card — back", ar: "بطاقة الإقامة — الوجه الخلفي", type: "GCC_RESIDENCE" },
  { code: "SA_RESIDENCE_PROOF", en: "Residence proof from Muqeem or Absher", ar: "إثبات الإقامة من مقيم أو أبشر", type: "GCC_RESIDENCE" },
  { code: "SA_ABSHER_REPORT", en: "Absher residence report (separate document)", ar: "تقرير الإقامة من أبشر — مستند مستقل", type: "GCC_RESIDENCE" },
  { code: "KW_MOBILE_ID", en: "Kuwait Mobile ID proof", ar: "إثبات الهوية الرقمية من تطبيق هويتي", type: "GCC_RESIDENCE" },
  { code: "BH_RESIDENCE_REPORT", en: "Bahrain residence permit report", ar: "تقرير تصريح الإقامة البحريني", type: "GCC_RESIDENCE" },
  { code: "QA_RESIDENCE_CARD", en: "Qatar residence card", ar: "بطاقة الإقامة القطرية", type: "GCC_RESIDENCE" },
  { code: "PASSPORT", en: "Passport — complete, clear personal data page", ar: "جواز السفر — صفحة البيانات الشخصية كاملة وواضحة", type: "PASSPORT" },
  { code: "PERSONAL_PHOTO", en: "Personal photo", ar: "الصورة الشخصية", type: "PERSONAL_PHOTO" },
  { code: "GCC_RESIDENCE", en: "Residence permit", ar: "تصريح الإقامة", type: "GCC_RESIDENCE" },
] as const;
