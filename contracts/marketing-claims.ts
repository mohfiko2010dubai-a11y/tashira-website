/** Current service claims explicitly approved by the owner. */
export const MARKETING_CLAIMS = {
  en: {
    license: "Licensed in Meydan Free Zone — Licence 2541485.01",
    documentReview: "Every application document-checked before submission",
    responseTime: "Apply any time — the application is open 24 hours",
    languages: "Arabic and English support",
    eligibility: "Most nationalities — check your eligibility in a minute",
    commitments: "Our service commitments",
  },
  ar: {
    license: "مرخصة في منطقة ميدان الحرة — رخصة 2541485.01",
    documentReview: "نراجع مستندات كل طلب قبل تقديمه",
    responseTime: "قدّم في أي وقت — الطلب متاح ٢٤ ساعة",
    languages: "دعم بالعربية والإنجليزية",
    eligibility: "معظم الجنسيات — تحقق من أهليتك في دقيقة",
    commitments: "التزامات خدمتنا",
  },
} as const;
export function marketingClaims(language: string) {
  return MARKETING_CLAIMS[language.toLowerCase().startsWith("ar") ? "ar" : "en"];
}
