export const DISTINCT_DOCUMENT_MESSAGE = "This file is already used for the residence proof or separate Absher report. Upload a different document for this requirement.";
export const MAX_DOCUMENT_FILE_SIZE = 20 * 1024 * 1024;
export const DOCUMENT_INPUT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif";
export const PHOTO_CONVERSION_GUIDANCE = "We could not read this photo. On iPhone, open Settings > Camera > Formats and choose 'Most Compatible', then take the photo again.";
export const UPLOAD_RETRY_GUIDANCE = "The upload did not finish. Check your connection and retry.";
export const UNSUPPORTED_DOCUMENT_GUIDANCE = `File type not allowed. Choose a PDF, JPG, PNG, HEIC or HEIF file. ${PHOTO_CONVERSION_GUIDANCE}`;
export const DOCUMENT_SIZE_GUIDANCE = "File size must be between 1 byte and 20 MB. Choose a smaller, non-empty file.";
export const DOCUMENT_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

export function documentDownloadName(fileName: string, mimeType: string): string {
  const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/png" ? ".png" : null;
  return extension ? fileName.replace(/\.[^.]*$/, "") + extension : fileName;
}

export function documentMimeType(mimeType: string, fileName: string): string {
  const mime = mimeType.toLowerCase();
  if (DOCUMENT_MIME_TYPES.has(mime)) return mime;
  const extension = fileName.toLowerCase().split(".").pop();
  return ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif" } as Record<string, string>)[extension ?? ""] ?? mime;
}

export function documentUploadError(message: string, ar: boolean): string {
  if (message === "Too many requests") return ar ? "وصلت إلى حد الرفع. انتظر دقيقة، ثم أعد محاولة رفع هذا الملف." : "Upload limit reached. Wait one minute, then retry this file.";
  if (message === DISTINCT_DOCUMENT_MESSAGE) return ar ? "هذا الملف مستخدم لإثبات الإقامة أو تقرير أبشر المنفصل. ارفع مستندًا مختلفًا لهذا المتطلب." : message;
  if (!ar) return [PHOTO_CONVERSION_GUIDANCE, UNSUPPORTED_DOCUMENT_GUIDANCE, DOCUMENT_SIZE_GUIDANCE].includes(message) ? message : UPLOAD_RETRY_GUIDANCE;
  if (message === PHOTO_CONVERSION_GUIDANCE) return "تعذر قراءة الصورة. على آيفون، افتح الإعدادات > الكاميرا > التنسيقات واختر «الأكثر توافقًا»، ثم التقط الصورة مرة أخرى.";
  if (message === UNSUPPORTED_DOCUMENT_GUIDANCE) return "نوع الملف غير مدعوم. اختر ملف PDF أو JPG أو PNG أو HEIC أو HEIF. على آيفون، يمكنك اختيار «الأكثر توافقًا» من الإعدادات > الكاميرا > التنسيقات ثم التقاط الصورة مجددًا.";
  if (message === DOCUMENT_SIZE_GUIDANCE) return "اختر ملفًا غير فارغ بحجم لا يزيد عن 20 ميجابايت.";
  return "لم يكتمل الرفع. تحقق من اتصالك بالإنترنت وأعد المحاولة.";
}

export type DocumentUploadProgress = { phase: "preparing" | "uploading" | "processing" | "saving"; percent?: number };
