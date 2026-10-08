import { trpc } from '@/providers/trpc-client';
import { applicationStatusLabels } from '@/components/admin/application-display';

const emailLabels: Record<string, string> = {
  APPLICATION_RECEIVED: 'استلام الطلب', PAYMENT_SUCCESS: 'تأكيد الدفع والفاتورة', PAYMENT_FAILED: 'تعذر الدفع',
  DOCUMENTS_REQUIRED: 'استكمال المستندات', SUBMITTED: 'التقديم للهجرة', STATUS_CHANGED: 'تحديث حالة الطلب',
  VISA_ISSUED: 'إصدار التأشيرة', RESUME_LINK: 'رابط استكمال الطلب', RESUME_REMINDER: 'تذكير باستكمال الطلب',
  SECURITY_DEPOSIT_REQUEST: 'رابط دفع التأمين', REFUND_COMPLETED: 'نتيجة الاسترداد', DOCUMENTS_COMPLETE: 'اكتمال المستندات',
  PRODUCT_SUBSTITUTED: 'عرض تعديل التأشيرة', REJECTED: 'قرار رفض الطلب', REVIEW_REQUEST: 'طلب تقييم الخدمة',
};
const deliveryLabels: Record<string, string> = {
  QUEUED: 'بانتظار الإرسال', SENT: 'قبله مزوّد البريد — لم يتأكد الوصول بعد', DELIVERED: 'أكد مزوّد البريد التسليم',
  FAILED: 'تعذر الإرسال', BOUNCED: 'تعذر التسليم للعنوان', SUPPRESSED: 'لم يُرسل',
};

export default function CustomerProgressPanel({ referenceNumber }: { referenceNumber: string }) {
  const application = trpc.application.getByReference.useQuery({ referenceNumber });
  const history = trpc.emailOperations.history.useQuery({ referenceNumber });
  return <section dir="rtl" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">حالة العميل وإشعاراته</h2>
      <button type="button" className="rounded-lg border px-3 py-2" onClick={() => { void application.refetch(); void history.refetch(); }}>تحديث</button></div>
    {application.isLoading && <p role="status">جارٍ تحميل الحالة…</p>}
    {application.error && <p role="alert">تعذر تحميل حالة العميل. حدّث الصفحة قبل متابعة الطلب.</p>}
    {application.data && <div className="rounded-xl bg-slate-50 p-4"><p>حالة الطلب المسجلة للتتبع: <strong>{applicationStatusLabels[application.data.status] || application.data.status}</strong></p>
      <p>الدفع: {applicationStatusLabels[application.data.paymentStatus] || application.data.paymentStatus}</p>
      <p className="mt-2 text-sm text-slate-600">قائمة عمل الموظف منفصلة عن هذه الحالة. إرسال رابط دفع أو إنشاء طلب استرداد لا يؤكد تحرك المبلغ.</p></div>}
    <h3 className="font-semibold">سجل إشعارات العميل — آخر ١٠٠ سجل إرسال</h3>
    <p className="text-sm text-slate-600">تأكيد التسليم من المزوّد لا يثبت قراءة العميل أو وصول الرسالة إلى الوارد بدل البريد غير المرغوب.</p>
    {history.isLoading && <p role="status">جارٍ تحميل سجل البريد…</p>}
    {history.error && <p role="alert">تعذر تحميل سجل البريد. اضغط تحديث؛ لا تعتبر غياب السجل إثباتًا لعدم الإرسال.</p>}
    {history.data?.length === 0 && <p>لا توجد أدلة إرسال مسجلة لهذا الطلب.</p>}
    <ul className="divide-y">{history.data?.map(event => <li key={event.id} className="py-3">
      <div className="flex flex-wrap justify-between gap-2"><span>{emailLabels[event.template] || 'إشعار متعلق بالطلب'}</span><span>{deliveryLabels[event.status] || 'حالة تحتاج مراجعة'}</span></div>
      <p className="text-sm text-slate-500">{new Date(event.createdAt).toLocaleString('ar-AE', { timeZone: 'Asia/Dubai' })} — دبي</p>
    </li>)}</ul>
  </section>;
}
