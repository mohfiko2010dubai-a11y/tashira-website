import { useRef, useState } from 'react';
import { trpc } from '@/providers/trpc-client';
import { TERMS_POLICY_VERSION } from '@contracts/constants';

const states: Record<string, string> = { DRAFT: 'مسودة', PENDING_APPROVAL: 'بانتظار اعتماد المدير', APPROVED: 'معتمد — بانتظار التنفيذ', PROCESSING: 'جارٍ التنفيذ', PARTIALLY_REFUNDED: 'تم استرداد جزء', REFUNDED: 'تم الاسترداد', FAILED: 'تعذر التنفيذ — راجع المدير', CANCELLED: 'ملغى' };
export default function RefundRequest({ applicationId, arabic = false }: { applicationId: number; arabic?: boolean }) {
  const sources = trpc.refund.eligibleSources.useQuery({ applicationId });
  const cases = trpc.refund.listByApplication.useQuery({ applicationId });
  const [sourceKey, setSourceKey] = useState('');
  const source = sources.data?.find(item => item.availableAmount > 0 && `${item.sourceType}:${item.id}` === sourceKey);
  const [amount, setAmount] = useState(''), [reason, setReason] = useState(''), [message, setMessage] = useState('');
  const requestKey = useRef<{ payload: string; id: string } | null>(null);
  const mutation = trpc.refund.createCase.useMutation({ onError: error => setMessage(error.message), onSuccess: async () => {
    requestKey.current = null; setMessage(arabic ? 'تم تسجيل طلب الاسترداد. راجع حالته أدناه؛ التسجيل وحده لا يعيد المبلغ.' : 'Refund request recorded. Check its status below; recording does not move money.');
    setAmount(''); setReason(''); setSourceKey(''); await Promise.all([sources.refetch(), cases.refetch()]);
  } });
  return <section className="space-y-3 rounded-xl border bg-white p-4"><h2 className="text-lg font-bold">{arabic ? 'طلب استرداد للعميل' : 'Request a refund'}</h2>
    <p>{arabic ? 'اختر الدفعة وحدد المبلغ والسبب. الاعتماد والتنفيذ لدى المدير، ويظهر وضع الطلب أدناه.' : 'Choose a payment, amount and reason. A manager approves and executes the refund; its status appears below.'}</p>
    <button type="button" className="rounded border px-3 py-2" onClick={() => { void sources.refetch(); void cases.refetch(); }}>{arabic ? 'تحديث المدفوعات والطلبات' : 'Refresh payments and requests'}</button>
    {sources.isLoading && <p role="status">{arabic ? 'جارٍ تحميل المدفوعات…' : 'Loading payments…'}</p>}
    {(sources.isError || cases.isError) && <p role="alert">{arabic ? 'تعذر تحميل بعض البيانات. اضغط تحديث قبل إرسال طلب جديد.' : 'Some data could not be loaded. Refresh before submitting a new request.'}</p>}
    {sources.isSuccess && sources.data.some(item => item.availableAmount > 0) ? <form className="space-y-3" onSubmit={event => {
      event.preventDefault(); if (!source || mutation.isPending) return;
      const payload = { applicationId, reason, policyVersion: TERMS_POLICY_VERSION,
        items: [source.sourceType === 'VISA_SERVICE'
          ? { sourceType: 'VISA_SERVICE' as const, paymentId: Number(source.id), requestedAmount: Number(amount), deduction: { type: 'NONE' as const } }
          : { sourceType: 'SECURITY_DEPOSIT' as const, securityDepositPaymentId: String(source.id), requestedAmount: Number(amount), deduction: { type: 'NONE' as const } }],
      };
      const serialized = JSON.stringify(payload);
      if (requestKey.current?.payload !== serialized) requestKey.current = { payload: serialized, id: crypto.randomUUID() };
      mutation.mutate({ ...payload, commandId: requestKey.current.id });
    }}><fieldset disabled={mutation.isPending} className="space-y-3">
      <label className="block">{arabic ? 'الدفعة المراد الاسترداد منها' : 'Payment to refund'}<select required className="block w-full rounded border p-3" value={sourceKey} onChange={event => { setSourceKey(event.target.value); setAmount(''); }}>
        <option value="">{arabic ? 'اختر الدفعة' : 'Choose a payment'}</option>
        {sources.data.filter(item => item.availableAmount > 0).map(item => <option key={`${item.sourceType}:${item.id}`} value={`${item.sourceType}:${item.id}`}>{item.sourceType === 'VISA_SERVICE' ? (arabic ? 'دفعة التأشيرة' : 'Visa payment') : (arabic ? 'التأمين المسترد' : 'Security deposit')} #{item.id} — {item.availableAmount.toFixed(2)} {item.currency}</option>)}
      </select></label>
      {source && <p>{arabic ? 'المدفوع' : 'Paid'} {source.originalAmount.toFixed(2)} {source.currency} · {arabic ? 'المتاح للاسترداد' : 'Available'} {source.availableAmount.toFixed(2)}</p>}
      <label className="block">{arabic ? 'المبلغ المطلوب رده' : 'Refund amount'}<input required type="number" min="0.01" step="0.01" max={source?.availableAmount} value={amount} onChange={event => setAmount(event.target.value)} className="block w-full rounded border p-3" /></label>
      <label className="block">{arabic ? 'سبب الاسترداد' : 'Reason'}<textarea required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="block w-full rounded border p-3" /></label>
      <button disabled={!source || sources.isError || cases.isError} className="min-h-11 rounded bg-slate-900 px-4 text-white disabled:opacity-50">{arabic ? 'إرسال طلب الاسترداد للمدير' : 'Send for approval'}</button>
    </fieldset></form> : sources.isSuccess && <p>{arabic ? 'لا توجد دفعة متاحة لاسترداد جديد. راجع الطلبات القائمة أدناه.' : 'No payment is available for a new refund. Check existing requests below.'}</p>}
    <p aria-live="polite">{message}</p><h3 className="font-bold">{arabic ? 'طلبات الاسترداد المسجلة' : 'Recorded refund requests'}</h3>
    {cases.isLoading && <p role="status">{arabic ? 'جارٍ تحميل الطلبات…' : 'Loading requests…'}</p>}
    {cases.data?.length === 0 && <p>{arabic ? 'لا توجد طلبات استرداد مسجلة.' : 'No refund requests recorded.'}</p>}
    <ul className="divide-y">{cases.data?.map(item => <li key={item.id} className="space-y-1 py-3"><strong>{arabic ? states[item.status] || 'تحتاج مراجعة' : item.status}</strong><p>{item.reason}</p>
      {item.items.map(payment => <p key={payment.id}>{payment.sourceType === 'SECURITY_DEPOSIT' ? (arabic ? 'تأمين' : 'Deposit') : (arabic ? 'تأشيرة' : 'Visa')}: {Number(payment.refundAmount).toFixed(2)} {payment.currency}</p>)}
    </li>)}</ul>
  </section>;
}
