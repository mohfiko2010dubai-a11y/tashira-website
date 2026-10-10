import { trpc } from '@/providers/trpc-client';

const labels: Record<string, string> = {
  DRAFT: 'محفوظ — لم يتأكد إرسال الرابط', SENT: 'أُرسل الرابط — بانتظار العميل',
  ACCEPTED: 'وافق العميل — بانتظار الدفع', DECLINED: 'رفض العميل التأمين',
  PAYMENT_PENDING: 'بانتظار تأكيد الدفع', PAID: 'تم استلام التأمين',
  REFUND_PENDING: 'طلب الاسترداد قيد المتابعة', PARTIALLY_REFUNDED: 'رُد جزء من التأمين',
  REFUNDED: 'رُد التأمين', CANCELLED: 'ملغى', EXPIRED: 'انتهت صلاحية الرابط',
};
const formatDate = (value: Date | string) => new Date(value).toLocaleString('ar-AE', { timeZone: 'Asia/Dubai' });
export default function SecurityDepositStatus({ applicationId }: { applicationId: number }) {
  const query = trpc.securityDeposit.operationalStatus.useQuery({ applicationId });
  return <section dir="rtl" className="space-y-3 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">متابعة التأمين المسترد</h2>
      <button type="button" className="rounded-lg border px-3 py-2" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>تحديث</button></div>
    <p className="text-sm text-slate-600">إنشاء طلب التأمين وإرسال رابطه لدى المدير. تابع رد العميل والدفع هنا، واستخدم قسم الاسترداد أدناه لطلب رد مبلغ تم استلامه.</p>
    {query.isLoading && <p role="status">جارٍ تحميل التأمين…</p>}
    {query.isError && <p role="alert">تعذر تحميل بيانات التأمين. اضغط تحديث قبل متابعة الطلب.</p>}
    {query.isSuccess && query.data.length === 0 && <p>لا يوجد طلب تأمين مسجل لهذا الطلب.</p>}
    <ul className="divide-y">{query.data?.map(item => <li key={item.id} className="space-y-2 py-3">
      <div className="flex flex-wrap justify-between gap-2"><strong>{Number(item.amount).toFixed(2)} {item.currency}</strong><span>{labels[item.status] || 'حالة تحتاج مراجعة المدير'}</span></div>
      <p>{item.purpose}</p>
      {item.sentAt && <p className="text-sm text-slate-600">إرسال الرابط: {formatDate(item.sentAt)} — دبي</p>}
      {item.paidAt && <p className="text-sm text-slate-600">استلام التأمين: {formatDate(item.paidAt)} — دبي</p>}
      {['DRAFT', 'SENT', 'ACCEPTED', 'PAYMENT_PENDING', 'EXPIRED'].includes(item.status) && <p className="text-sm text-slate-600">صلاحية الرابط حتى: {formatDate(item.expiresAt)} — دبي</p>}
    </li>)}</ul>
  </section>;
}
