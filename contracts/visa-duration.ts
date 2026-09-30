export function visaStayDuration(serviceCode: string, ar: boolean) {
  const duration = /^(\d+)(days|hours)-/.exec(serviceCode);
  if (!duration) return ar ? "تحقّق من تفاصيل الخدمة" : "Check service details";
  const amount = Number(duration[1]).toLocaleString(ar ? "ar" : "en");
  return `${amount} ${duration[2] === "hours" ? ar ? "ساعة" : "hours" : ar ? "يومًا" : "days"}`;
}
export const VISA_DURATION_EXPLANATION = {
  en: "Stay: how long you may remain in the UAE from the date you enter. Validity: the period within which you must enter.",
  ar: "مدة الإقامة: المدة المسموح لك بالبقاء داخل الإمارات من تاريخ الدخول. الصلاحية: المدة التي يجب أن تدخل خلالها.",
};
