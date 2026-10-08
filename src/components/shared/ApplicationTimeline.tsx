import { useState } from "react";
import { Download, History, Plus } from "lucide-react";
import { trpc } from "@/providers/trpc-client";
import { formatOperationDate } from '@/components/admin/application-display';

const OPERATIONAL_EVENTS = [
  "DOCUMENTS_VALIDATED", "ADDITIONAL_DOCUMENTS_REQUESTED", "GOVERNMENT_PROCESSING",
  "VISA_APPROVED", "VISA_ISSUED", "APPLICATION_COMPLETED", "APPLICATION_CANCELLED", "APPLICATION_REJECTED",
  "DISPUTE_NOTE_ADDED", "MANUAL_REVIEW_REQUESTED",
] as const;

const eventLabels: Record<string, string> = {
 VISA_DOWNLOADED: "تنزيل التأشيرة", DOCUMENT_REVIEW_DECISION: "تسجيل قرار مراجعة المستندات", STRIPE_FEE_RECONCILIATION_PENDING: "بانتظار مطابقة رسوم Stripe",
 APPLICANT_ADDED: "إضافة مسافر", APPLICANT_UPDATED: "تعديل بيانات مسافر", APPLICATION_SUBMITTED: "إرسال الطلب", POLICY_ACCEPTED: "قبول الشروط والسياسات",
 PASSPORT_UPLOADED: "رفع جواز السفر", PHOTO_UPLOADED: "رفع الصورة الشخصية", SUPPORTING_DOCUMENT_UPLOADED: "رفع مستند داعم", DOCUMENT_REPLACED: "استبدال مستند", DOCUMENT_DELETED: "حذف مستند", DOCUMENT_REPLACEMENT_REQUESTED: "طلب استبدال مستند",
 CHECKOUT_OPENED: "فتح صفحة الدفع", PAYMENT_ELEMENT_LOADED: "تحميل نموذج الدفع", PAYMENT_STARTED: "بدء الدفع", PAYMENT_INTENT_CREATED: "إنشاء عملية الدفع", THREE_DS_REQUIRED: "طلب التحقق البنكي", THREE_DS_COMPLETED: "اكتمال التحقق البنكي", PAYMENT_FAILED: "فشل الدفع", PAYMENT_RETRIED: "إعادة محاولة الدفع", PAYMENT_CONFIRMED: "تأكيد الدفع", CHECKOUT_ABANDONED: "مغادرة الدفع دون إكماله", PAYMENT_PAGE_CLOSED: "إغلاق صفحة الدفع",
 WEBHOOK_RECEIVED: "استلام إشعار Stripe", WEBHOOK_VERIFIED: "التحقق من إشعار Stripe", INVOICE_GENERATED: "إصدار الفاتورة", INVOICE_DOWNLOAD_LINK_CREATED: "إنشاء رابط تنزيل الفاتورة", INVOICE_DOWNLOADED: "تنزيل الفاتورة", PROCESSING_STARTED: "بدء معالجة الطلب", EVIDENCE_PACKAGE_GENERATED: "إنشاء ملف الأدلة", EVIDENCE_PACKAGE_DOWNLOADED: "تنزيل ملف الأدلة", EMAIL_FAILED: "تعذر إرسال البريد", EMAIL_DELIVERED: "توصيل البريد", EMAIL_QUEUED: "إضافة البريد لقائمة الإرسال",
 DOCUMENTS_VALIDATED: "تمت مراجعة المستندات", ADDITIONAL_DOCUMENTS_REQUESTED: "طلب مستندات إضافية", GOVERNMENT_PROCESSING: "قيد المعالجة لدى الجهة", VISA_APPROVED: "الموافقة على التأشيرة", VISA_ISSUED: "صدور التأشيرة", APPLICATION_COMPLETED: "اكتمال الطلب", APPLICATION_CANCELLED: "إلغاء الطلب", APPLICATION_REJECTED: "رفض الطلب", DISPUTE_NOTE_ADDED: "إضافة ملاحظة نزاع", MANUAL_REVIEW_REQUESTED: "طلب مراجعة يدوية", PAYMENT_RECEIVED: "استلام الدفع", PAYMENT_SUCCEEDED: "نجاح الدفع", DOCUMENT_UPLOADED: "رفع مستند", APPLICATION_CREATED: "إنشاء الطلب", EMAIL_SENT: "إرسال بريد", REFUND_REQUESTED: "طلب استرداد", REFUND_SUCCEEDED: "نجاح الاسترداد", CUSTOMER_CONSENT_ACCEPTED: "موافقة العميل", PAYER_AUTHORIZATION_ACCEPTED: "قبول تفويض الدفع"
};
function eventLabel(value: string, ar = false) {
  if (ar && eventLabels[value]) return eventLabels[value];
  return value.toLowerCase().split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

export default function ApplicationTimeline({ referenceNumber, admin = false, language = "en" }: { referenceNumber: string; admin?: boolean; language?: "ar" | "en" }) {
  const ar = language === "ar";
  const utils = trpc.useUtils();
  const timeline = trpc.timeline.list.useQuery({ referenceNumber });
  const [eventName, setEventName] = useState<(typeof OPERATIONAL_EVENTS)[number]>("DOCUMENTS_VALIDATED");
  const operationalEvent = trpc.timeline.recordOperationalEvent.useMutation({
    onSuccess: () => utils.timeline.list.invalidate({ referenceNumber }),
  });
  const evidence = trpc.timeline.generateEvidenceManifest.useMutation();
  const evidenceDownload = trpc.timeline.recordEvidenceDownload.useMutation({
    onSuccess: () => utils.timeline.list.invalidate({ referenceNumber }),
  });

  const downloadEvidence = async () => {
    const result = await evidence.mutateAsync({ referenceNumber });
    const blob = new Blob([JSON.stringify({ sha256: result.sha256, manifest: result.manifest }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${referenceNumber}-chargeback-evidence.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    await evidenceDownload.mutateAsync({ referenceNumber, sha256: result.sha256 });
  };

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold  text-gray-900">
          <History size={16} /> {ar ? "سجل عمليات الطلب" : "Application timeline"}
        </h2>
        {admin && (
          <div className="flex flex-wrap gap-2">
            <select value={eventName} onChange={(event) => setEventName(event.target.value as typeof eventName)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
              {OPERATIONAL_EVENTS.map((event) => <option key={event} value={event}>{eventLabel(event, ar)}</option>)}
            </select>
            <button onClick={() => operationalEvent.mutate({ referenceNumber, eventName })} disabled={operationalEvent.isPending} className="inline-flex items-center gap-1 min-h-11 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Plus size={13} /> {ar ? "تسجيل الحدث" : "Add event"}
            </button>
            <button onClick={() => { void downloadEvidence().catch(() => { /* Mutation state displays the error above. */ }); }} disabled={evidence.isPending || evidenceDownload.isPending} className="inline-flex items-center gap-1 min-h-11 rounded-lg bg-[#C9A04C] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Download size={13} /> {ar ? "تنزيل ملف الأدلة" : "Evidence JSON"}
            </button>
          </div>
        )}
      </div>

      {admin && <p className="mb-5 rounded-xl bg-slate-50 p-3 text-sm">{ar ? "هذا سجل تدقيق: اختر حدثًا حدث بالفعل ثم سجّله. تسجيل الحدث لا ينفّذ دفعًا أو استردادًا." : "Record events that have actually happened. Recording does not execute a payment or refund."}</p>}
      {(timeline.error || operationalEvent.error || evidence.error || evidenceDownload.error) && <p role="alert" className="mb-4 text-red-700">{ar ? "لم يكتمل الإجراء. حدّث السجل وراجع النتيجة قبل المحاولة مجددًا." : "The action did not complete. Refresh the timeline and check the result before retrying."}</p>}
      {operationalEvent.isSuccess && <p role="status">{ar ? "تم تسجيل الحدث." : "Event recorded."}</p>}
      {timeline.isLoading ? <p className="text-sm text-slate-500">{ar ? "جارٍ تحميل السجل…" : "Loading timeline…"}</p> : timeline.data?.length ? (
        <ol className="space-y-0">
          {timeline.data.map((event) => (
            <li key={event.id} className="relative border-s-2 border-[#C9A04C]/30 pb-5 ps-5 last:pb-0">
              <span className="absolute -start-[5px] top-1 h-2 w-2 rounded-full bg-[#C9A04C]" />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{eventLabel(event.eventName, ar)}</p>
                  {event.consentValidity === "INVALID" && <p role="note" className="mt-1 text-sm font-semibold text-red-700">{ar ? "هذه الموافقة التاريخية غير صالحة لإثبات قبول العميل." : "Not valid consent — this historical record is not evidence of customer acceptance."}</p>}
                  {event.summary && <p className="mt-1 text-sm text-gray-500">{event.summary}</p>}
                </div>
                <time className="text-sm text-slate-500">{ar ? formatOperationDate(event.createdAt) : new Date(event.createdAt).toLocaleString()}</time>
              </div>
              <details className="mt-2 text-sm text-slate-500"><summary className="cursor-pointer">{ar ? "تفاصيل العملية التقنية" : "Technical event details"}</summary><div dir="ltr" className="mt-2 flex flex-wrap gap-2">
                <span>{event.actorType}</span><span>•</span><span>{event.eventSource}</span>
                {event.resultingState && <><span>•</span><span>{event.resultingState}</span></>}
                {admin && event.attemptNumber && <><span>•</span><span>Attempt {event.attemptNumber}</span></>}
                {admin && event.sanitizedCategory && <><span>•</span><span>{event.sanitizedCategory}</span></>}
              </div></details>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-slate-500">{ar ? "لم تُسجّل عمليات بعد." : "No timeline events have been recorded yet."}</p>}
    </section>
  );
}
