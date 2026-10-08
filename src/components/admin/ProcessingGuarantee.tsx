import { Link } from "react-router-dom";
import { trpc } from "@/providers/trpc-client";

export function ProcessingGuarantee({ applicationId }: { applicationId?: number }) {
  const utils = trpc.useUtils();
  const query = trpc.refund.processingGuarantees.useQuery(applicationId ? { applicationId } : {}, { refetchInterval: 60_000 });
  const claim = trpc.refund.claimExpressGuarantee.useMutation({ onSuccess: async () => {
    await Promise.all([utils.refund.processingGuarantees.invalidate(), utils.refund.listByApplication.invalidate(), utils.refund.eligibleSources.invalidate()]);
  } });
  const entries = (query.data ?? []).filter(item => applicationId || (item.breached && !item.refundCaseId));
  if (!applicationId && !query.error && !entries.length) return null;
  return <section className="my-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm" aria-label="ضمان إرسال الطلب">
    <h2 className="text-lg font-bold">{applicationId ? "ضمان إرسال الطلب" : "ضمانات المستعجل التي تحتاج إجراء"}</h2>
    {query.error && <p role="alert">تعذر تحميل متابعة الضمان. حدّث الصفحة للتحقق من الطلبات المتأخرة.</p>}
    {query.isLoading && <p role="status">جارٍ تحميل الضمان…</p>}
    {entries.map(item => <div key={item.applicationId} className="mt-3 space-y-2">
      {!applicationId && <Link className="underline" to={`/admin/applications/${item.referenceNumber}`}>{item.referenceNumber}</Link>}
      <p>اكتمال المستندات: {item.documentsCompletedAt ?? "غير مسجّل بعد"}</p>
      <p>الإرسال إلى الجهة: {item.submittedAt ?? "غير مسجّل — بعد الإرسال الفعلي، احفظ حالة «قيد المعالجة لدى الجهة»"}</p>
      <p>الموعد النهائي{item.paused ? " (معلّق؛ يُعاد احتسابه بعد الرد)" : ""}: {item.deadline ?? "يبدأ عند اكتمال كل المستندات المطلوبة"}</p>
      {item.paused && <p role="status">بانتظار العميل: {item.pauseReasons.join(", ")}. مدة انتظار العميل لا تُحتسب.</p>}
      {item.express && <p>رسوم المستعجل المدفوعة: {item.expressFee === null ? "عرض قديم — لا توجد رسوم ضمان مسجّلة" : `${item.currency} ${item.expressFee.toFixed(2)}`}</p>}
      {item.breached && <p role="status" className="font-semibold">تم تجاوز موعد الإرسال.{item.express && item.paid ? " يستحق العميل استرداد رسوم المستعجل المدفوعة كاملة." : ""}</p>}
      {item.refundCaseId ? <p>طلب استرداد المستعجل: {item.refundCaseId}. تم اعتماده تلقائيًا؛ راجع نتيجة Stripe في <Link className="underline" to="/admin/approvals">الموافقات</Link>.</p>
        : item.express && item.breached && item.paid && <><p>يفحص النظام الضمان كل دقيقة. قد يحتاج الاسترداد المتعارض إلى مراجعة.</p><button className="min-h-11 rounded border bg-white px-3" disabled={claim.isPending} onClick={() => claim.mutate({ applicationId: item.applicationId })}>إعادة فحص استحقاق الضمان</button></>}
    </div>)}
    {claim.error && <p role="alert" className="mt-2 text-red-700">{claim.error.message}</p>}
  </section>;
}
