/** Owner-approved service handling copy. Authority issuance is never promised. */
export const PROCESSING_COPY = {
  en: {
    regular: "We submit your application within 24 hours of your documents being complete. Issuing time is decided by the authority.",
    express: "Priority handling — we submit within 6 hours of your documents being complete. Issuing time is decided by the authority.",
    headline: "Your UAE visa application, handled with care",
    regularLabel: "Regular handling", expressLabel: "Express handling",
  },
  ar: {
    regular: "نقدّم طلبك خلال 24 ساعة من اكتمال مستنداتك. تحدد الجهة المختصة موعد إصدار التأشيرة.",
    express: "معالجة ذات أولوية — نقدّم طلبك خلال 6 ساعات من اكتمال مستنداتك. تحدد الجهة المختصة موعد إصدار التأشيرة.",
    headline: "طلب تأشيرة الإمارات، نتابعه بعناية",
    regularLabel: "المعالجة العادية", expressLabel: "المعالجة السريعة",
  },
} as const;
export function processingCopy(language: string) {
  return PROCESSING_COPY[language.toLowerCase().startsWith("ar") ? "ar" : "en"];
}
