import { requiredDocuments, type DocumentRequirementContext } from "./document-requirement-engine";
import { MAX_DOCUMENT_FILE_SIZE } from "./document-upload-policy";
import { languagePath, type SiteLanguage } from "./language-routes";

/** Guidance delegates requirements to the same approved rules used by the form. */
export const assistantDocuments = (context: DocumentRequirementContext) => requiredDocuments(context);
export const assistantReference = (value: string | null | undefined) => value && /^TSH-[A-Z0-9-]+$/i.test(value) ? value : undefined;
export function assistantApplicationPath(language: SiteLanguage, reference?: string) {
  const safeReference = assistantReference(reference);
  return languagePath(safeReference
    ? `/apply/${encodeURIComponent(safeReference)}/interview` : "/apply", language);
}
export const ASSISTANT_GUIDANCE = {
  en: {
    steps: "1. Choose your visa, speed, single/family application, residence and trip purpose. 2. Enter each traveller’s details and upload their matched documents. 3. Review, explicitly accept the policies and pay after the required details and documents are complete.",
    family: "Trip purpose and residence are shared. Each traveller has their own nationality, passport details and document checklist. You can move freely between travellers and return to missing files before payment.",
    documents: "Requirements depend on nationality, country of residence, visa type, trip purpose and companion status. Flight tickets do not block payment. Additional supporting files and notes are optional.",
    passport: "Enter your full name in Latin letters exactly as printed in your passport, including middle names. Hyphens and apostrophes are allowed. The form checks six months’ passport validity and shows the exact minimum expiry date.",
    uploads: `Upload PDF, JPG, PNG, HEIC or HEIF, up to ${MAX_DOCUMENT_FILE_SIZE / 1024 / 1024} MB per file, in the secure application. Do not send passport scans or card details in chat or WhatsApp.`,
    payment: "Payment follows completion of the required traveller details and documents. Prices come from the current server quote, including the Express difference and traveller count. Visa approval is decided by the UAE authorities.",
  },
  ar: {
    steps: "١. اختر التأشيرة والسرعة والتقديم الفردي أو العائلي والإقامة وغرض الرحلة. ٢. أدخل بيانات كل مسافر وارفع مستنداته المحددة حسب حالته. ٣. راجع الطلب ووافق صراحةً على السياسات ثم ادفع بعد اكتمال البيانات والمستندات المطلوبة.",
    family: "غرض الرحلة والإقامة مشتركان. لكل مسافر جنسيته وبيانات جوازه وقائمة مستنداته. يمكنك التنقل بحرية بين المسافرين والعودة لاستكمال الملفات الناقصة قبل الدفع.",
    documents: "تتحدد المستندات حسب الجنسية وبلد الإقامة ونوع التأشيرة وغرض الرحلة وحالة المرافق. تذكرة الطيران لا تمنع الدفع. الملفات الداعمة الإضافية والملاحظات اختيارية.",
    passport: "اكتب الاسم الكامل بالحروف اللاتينية كما في الجواز، بما فيه الأسماء الوسطى. تُقبل الشرطة والفاصلة العليا. يتحقق الفورم من صلاحية الجواز لستة أشهر ويعرض لك تاريخ الانتهاء الأدنى بدقة.",
    uploads: `ارفع PDF أو JPG أو PNG أو HEIC أو HEIF، بحد أقصى ${MAX_DOCUMENT_FILE_SIZE / 1024 / 1024} ميجابايت للملف داخل الطلب الآمن. لا ترسل صور الجواز أو بيانات البطاقة في الشات أو واتساب.`,
    payment: "الدفع بعد اكتمال بيانات المسافرين ومستنداتهم المطلوبة. السعر من عرض السيرفر الحالي، شامل فرق Express وعدد المسافرين. قرار الموافقة على التأشيرة للجهات المختصة في الإمارات.",
  },
} as const;
