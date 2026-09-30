/** Owner-approved service handling copy. Authority issuance is never promised. */
import { EXPRESS_SUBMISSION_HOURS, REGULAR_SUBMISSION_HOURS } from "./processing-guarantee";
export const PROCESSING_COPY = {
  en: {
    regular: `We submit your application within ${REGULAR_SUBMISSION_HOURS} hours of your documents being complete. Issuing time is decided by the authority.`,
    express: `Priority handling — we submit within ${EXPRESS_SUBMISSION_HOURS} hours of your documents being complete, or we refund the express fee in full. Issuing time is decided by the authority.`,
    headline: "Your UAE visa application, handled with care",
    regularLabel: "Regular handling", expressLabel: "Express handling",
  },
  ar: {
    regular: `نقدّم طلبك خلال ${REGULAR_SUBMISSION_HOURS} ساعة من اكتمال مستنداتك. تحدد الجهة المختصة موعد إصدار التأشيرة.`,
    express: `معالجة ذات أولوية — نقدّم طلبك خلال ${EXPRESS_SUBMISSION_HOURS} ساعة من اكتمال مستنداتك، وإلا رددنا رسم الاستعجال كاملًا. تحدد الجهة المختصة موعد إصدار التأشيرة.`,
    headline: "طلب تأشيرة الإمارات، نتابعه بعناية",
    regularLabel: "المعالجة العادية", expressLabel: "المعالجة السريعة",
  },
} as const;
export function processingCopy(language: string) {
  return PROCESSING_COPY[language.toLowerCase().startsWith("ar") ? "ar" : "en"];
}
