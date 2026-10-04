import { useState } from 'react';
import { trpc } from '@/providers/trpc-client';

export default function RefundRequest({ applicationId }: { applicationId: number }) {
  const sources = trpc.refund.eligibleSources.useQuery({ applicationId });
  const source = sources.data?.find(item => item.sourceType === 'VISA_SERVICE');
  const [amount, setAmount] = useState(''), [reason, setReason] = useState(''), [message, setMessage] = useState('');
  const mutation = trpc.refund.createCase.useMutation({ onError: error => setMessage(error.message), onSuccess: () => { setMessage('Refund requested. A different named administrator must approve it.'); setAmount(''); setReason(''); void sources.refetch(); } });
  return <section className="rounded-xl border bg-white p-4"><h2 className="text-lg font-bold">Request a refund</h2><p>The request does not move money. Approval and execution are recorded separately.</p>
    {source ? <form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); mutation.mutate({ applicationId, reason, policyVersion: 'legal-bundle-2026-10-04-v4', items: [{ sourceType: 'VISA_SERVICE', paymentId: Number(source.id), requestedAmount: Number(amount), deduction: { type: 'NONE' } }] }); }}>
      <p>Paid {source.originalAmount.toFixed(2)} {source.currency} · available {source.availableAmount.toFixed(2)}</p>
      <label className="block">Refund amount<input required type="number" min="0.01" step="0.01" max={source.availableAmount} value={amount} onChange={e => setAmount(e.target.value)} className="block w-full rounded border p-3" /></label>
      <label className="block">Reason<textarea required minLength={5} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className="block w-full rounded border p-3" /></label>
      <button disabled={mutation.isPending} className="min-h-11 rounded bg-slate-900 px-4 text-white">Send for approval</button>
    </form> : <p>No refundable visa payment available.</p>}<p aria-live="polite">{message}</p>
  </section>;
}
