import { useState } from 'react';
import { trpc } from '@/providers/trpc-client';

export default function RefundRequest({ applicationId, arabic = false }: { applicationId: number; arabic?: boolean }) {
  const sources = trpc.refund.eligibleSources.useQuery({ applicationId });
  const source = sources.data?.find(item => item.sourceType === 'VISA_SERVICE');
  const [amount, setAmount] = useState(''), [reason, setReason] = useState(''), [message, setMessage] = useState('');
  const mutation = trpc.refund.createCase.useMutation({ onError: error => setMessage(error.message), onSuccess: () => { setMessage(arabic ? 'تم إنشاء طلب الاسترداد. يظهر للمدير لمراجعته واعتماده ثم تنفيذه.' : 'Refund requested. A different named administrator must approve it.'); setAmount(''); setReason(''); void sources.refetch(); } });
  return <section className="rounded-xl border bg-white p-4"><h2 className="text-lg font-bold">{arabic ? 'طلب استرداد للعميل' : 'Request a refund'}</h2><p>{arabic ? 'إنشاء الطلب لا يعيد أموالًا. الاعتماد وتنفيذ الاسترداد خطوتان منفصلتان ومسجلتان.' : 'The request does not move money. Approval and execution are recorded separately.'}</p>
    {sources.isLoading && <p role="status">{arabic ? 'جارٍ تحميل المدفوعات…' : 'Loading payments…'}</p>}
    {sources.isError && <p role="alert">{arabic ? 'تعذر تحميل المدفوعات. حدّث الصفحة قبل طلب الاسترداد.' : 'Could not load payments. Refresh before requesting a refund.'}</p>}
    {source ? <form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); mutation.mutate({ applicationId, reason, policyVersion: 'legal-bundle-2026-10-04-v4', items: [{ sourceType: 'VISA_SERVICE', paymentId: Number(source.id), requestedAmount: Number(amount), deduction: { type: 'NONE' } }] }); }}>
      <p>{arabic ? 'المدفوع' : 'Paid'} {source.originalAmount.toFixed(2)} {source.currency} · {arabic ? 'المتاح للاسترداد' : 'available'} {source.availableAmount.toFixed(2)}</p>
      <label className="block">{arabic ? 'المبلغ المطلوب رده' : 'Refund amount'}<input required type="number" min="0.01" step="0.01" max={source.availableAmount} value={amount} onChange={e => setAmount(e.target.value)} className="block w-full rounded border p-3" /></label>
      <label className="block">{arabic ? 'سبب الاسترداد' : 'Reason'}<textarea required minLength={5} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="block w-full rounded border p-3" /></label>
      <button disabled={mutation.isPending} className="min-h-11 rounded bg-slate-900 px-4 text-white">{arabic ? 'إرسال طلب الاسترداد للمدير' : 'Send for approval'}</button>
    </form> : sources.isSuccess && <p>{arabic ? 'لا توجد دفعة تأشيرة متاحة للاسترداد.' : 'No refundable visa payment available.'}</p>}<p aria-live="polite">{message}</p>
  </section>;
}
