import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../../api/router';
import { ProcessingGuarantee } from '@/components/admin/ProcessingGuarantee';

type QueueRow = inferRouterOutputs<AppRouter>['refundQueue']['list']['rows'][number];
function ApprovalRow({ row, refresh }: { row: QueueRow; refresh: () => void }) {
  const [password, setPassword] = useState(''), [reason, setReason] = useState(''), [message, setMessage] = useState('');
  const item = row.items[0];
  const charge = trpc.refundQueue.charge.useQuery({ paymentId: item?.paymentId || 0 }, { enabled: Boolean(item?.paymentId), retry: false });
  const options = { onSuccess: () => { setPassword(''); setMessage('Saved.'); refresh(); void charge.refetch(); }, onError: (error: { message: string }) => setMessage(error.message) };
  const approve = trpc.refund.approveCase.useMutation(options), execute = trpc.refund.executeCase.useMutation(options);
  const reject = trpc.refundQueue.reject.useMutation(options), retry = trpc.refundQueue.retry.useMutation(options), reconcile = trpc.refund.reconcileCase.useMutation(options);
  const pending = approve.isPending || execute.isPending || reject.isPending || retry.isPending || reconcile.isPending;
  const total = row.items.reduce((sum, entry) => sum + Number(entry.refundAmount), 0);
  const pendingTotal = row.items.filter(entry => entry.status === 'PENDING').reduce((sum, entry) => sum + Number(entry.refundAmount), 0);
  const affordable = charge.data && charge.data.currency === item?.currency && charge.data.remainingMinor >= Math.round(pendingTotal * 100);
  return <article id={`refund-case-${row.refundCase.id}`} className="rounded-xl border bg-white p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><Link className="font-semibold underline" to={`/admin/applications/${row.reference}`}>{row.reference}</Link><strong>{row.refundCase.status}</strong></div>
    <p>{row.customer} · {item?.currency} {total.toFixed(2)}</p>
    {pendingTotal > 0 && <p>Awaiting execution: {item?.currency} {pendingTotal.toFixed(2)}. Previously refunded items will not be sent again.</p>}
    <p>Requested by {row.requester || row.refundCase.requestedBy} · {new Date(row.refundCase.createdAt).toLocaleString()} · waiting {row.waitingHours} hours</p>
    <p>{row.refundCase.reason}</p>
    {row.refundCase.approvedBy && <p>Approved by {row.refundCase.approvedBy}</p>}
    {charge.isLoading && <p>Checking original Stripe charge…</p>}
    {charge.error && <p role="alert">Charge details unavailable. Refresh before execution.</p>}
    {charge.data && <p className="break-all"><a className="underline" href={charge.data.dashboardUrl} target="_blank" rel="noreferrer">Stripe charge {charge.data.chargeId}</a> · {charge.data.created ? new Date(charge.data.created * 1000).toLocaleString() : ''}<br />Paid {(charge.data.paidMinor/100).toFixed(2)} · refunded {(charge.data.refundedMinor/100).toFixed(2)} · remaining {(charge.data.remainingMinor/100).toFixed(2)} {charge.data.currency}</p>}
    {row.items.map(entry => <div key={entry.id}>{entry.stripeRefundId && <p className="break-all">Stripe result: {entry.status} · {entry.stripeRefundId}</p>}{entry.failureMessage && <p role="alert" className="rounded bg-red-50 p-3 text-red-800 whitespace-pre-wrap">{entry.failureMessage}</p>}</div>)}
    {['PENDING_APPROVAL','APPROVED','PROCESSING'].includes(row.refundCase.status) && <label className="block">Your account password<input className="block w-full rounded border p-3" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>}
    <div className="flex flex-wrap gap-2">
      {row.refundCase.status === 'PENDING_APPROVAL' && <button className="min-h-11 rounded bg-slate-900 px-4 text-white disabled:opacity-40" disabled={pending || !password || !affordable} onClick={() => approve.mutate({ refundCaseId: row.refundCase.id, adminPassword: password })}>Approve</button>}
      {row.refundCase.status === 'APPROVED' && <button className="min-h-11 rounded bg-slate-900 px-4 text-white disabled:opacity-40" disabled={pending || !password || !affordable} onClick={() => execute.mutate({ refundCaseId: row.refundCase.id, adminPassword: password, confirmation: 'EXECUTE REFUND' })}>Execute approved refund</button>}
      {['FAILED','PARTIALLY_REFUNDED'].includes(row.refundCase.status) && row.items.some(entry => entry.status === 'FAILED') && <button className="min-h-11 rounded border px-4" disabled={pending} onClick={() => retry.mutate({ refundCaseId: row.refundCase.id })}>Return failed items to approval queue</button>}
      {row.refundCase.status === 'PROCESSING' && <button className="min-h-11 rounded border px-4" disabled={pending || !password} onClick={() => reconcile.mutate({ refundCaseId: row.refundCase.id, adminPassword: password, confirmation: 'RECONCILE REFUND' })}>Check Stripe result</button>}
    </div>
    {['PENDING_APPROVAL','FAILED'].includes(row.refundCase.status) && <div className="flex flex-wrap gap-2"><input aria-label="Reason for rejecting refund" className="min-w-0 flex-1 rounded border p-3" placeholder="Required rejection reason" value={reason} onChange={e => setReason(e.target.value)} /><button className="min-h-11 rounded border px-4 disabled:opacity-40" disabled={pending || reason.trim().length < 5} onClick={() => reject.mutate({ refundCaseId: row.refundCase.id, reason })}>Reject</button></div>}
    <p aria-live="polite">{message}</p>
  </article>;
}
export default function AdminApprovals() {
  const query = trpc.refundQueue.list.useQuery(undefined, { retry: false });
  const emailFailures = trpc.emailOperations.failures.useQuery(undefined, { retry: false });
  const retryEmail = trpc.emailOperations.retry.useMutation({ onSuccess: () => { void emailFailures.refetch(); } });
  const totals = new Map<string, number>();
  for (const row of query.data?.rows || []) if (row.refundCase.status !== 'REFUNDED') for (const item of row.items) if (!['SUCCEEDED', 'CANCELLED'].includes(item.status)) totals.set(item.currency, (totals.get(item.currency) || 0) + Number(item.refundAmount));
  const refresh = () => { void query.refetch(); };
  return <main className="mx-auto max-w-4xl p-4 space-y-4"><Link to="/admin/applications">← Administration</Link><h1 className="text-2xl font-bold">Refund approvals</h1><p>Oldest requests first. The requester cannot approve their own request.</p>
    <section className="rounded-xl border bg-amber-50 p-4"><h2 className="font-bold">Stripe balance and pending refunds</h2>{query.data?.balance.error && <p role="alert">{query.data.balance.error}</p>}{query.data?.balance.available.map(entry => <p key={entry.currency}>Available: {(entry.amountMinor/100).toFixed(2)} {entry.currency}</p>)}{[...totals].map(([currency, amount]) => <p key={currency}>Pending: {amount.toFixed(2)} {currency}</p>)}<p>Balances may use a different settlement currency; these figures are not assumed equivalent.</p></section>
    <button className="min-h-11 rounded border px-4" onClick={refresh}>Refresh</button>
    {query.error && <p role="alert">Unable to load approvals. Refresh to try again.</p>}
    <div id="refund-failures" className="space-y-4">{query.data?.rows.map(row => <ApprovalRow key={row.refundCase.id} row={row} refresh={refresh} />)}</div>
    {query.data?.rows.length === 0 && <p>No refunds awaiting review.</p>}
    <div id="processing-guarantee"><ProcessingGuarantee /></div>
    <section className="rounded-xl border bg-white p-4 space-y-3"><h2 className="font-bold">Email delivery needs attention</h2>
      {emailFailures.error && <p role="alert">Could not load the email queue. Refresh to retry.</p>}
      {emailFailures.data?.length === 0 && <p>No failed queued messages. Inbox placement still requires a real delivery check.</p>}
      {emailFailures.data?.map(mail => <div key={mail.key} className="border-t pt-3"><p>{mail.reference} · {mail.template} · {mail.attempts} attempts</p><p>{mail.error}</p><button className="min-h-11 rounded border px-4" disabled={retryEmail.isPending} onClick={() => retryEmail.mutate({ key: mail.key })}>Retry after fixing the cause</button></div>)}
      {retryEmail.error && <p role="alert">{retryEmail.error.message}</p>}
    </section>
  </main>;
}
