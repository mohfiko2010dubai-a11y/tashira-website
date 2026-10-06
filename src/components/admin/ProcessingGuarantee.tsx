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
  return <section className="my-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm" aria-label="Submission guarantee">
    <h2 className="font-semibold">{applicationId ? "Submission guarantee" : "Express guarantees requiring action"}</h2>
    {query.error && <p role="alert">Guarantee monitoring could not load. Refresh to check overdue orders.</p>}
    {entries.map(item => <div key={item.applicationId} className="mt-3 space-y-2">
      {!applicationId && <Link className="underline" to={`/admin/applications/${item.referenceNumber}`}>{item.referenceNumber}</Link>}
      <p>Documents complete: {item.documentsCompletedAt ?? "Not yet recorded"}</p>
      <p>Submitted to authority: {item.submittedAt ?? "Not yet recorded — record the actual submission using the controlled Visa Processing transition"}</p>
      <p>Deadline{item.paused ? " (paused; will be restated after response)" : ""}: {item.deadline ?? "Starts when all required documents are complete"}</p>
      {item.paused && <p role="status">Waiting on customer: {item.pauseReasons.join(", ")}. Customer-held time is excluded.</p>}
      {item.express && <p>Paid Express component: {item.expressFee === null ? "Historical quote — no recorded guarantee component" : `${item.currency} ${item.expressFee.toFixed(2)}`}</p>}
      {item.breached && <p role="status" className="font-semibold">Submission deadline exceeded.{item.express && item.paid ? " Full paid Express fee refund is due." : ""}</p>}
      {item.refundCaseId ? <p>Express refund case: {item.refundCaseId}. Automatically approved; see its Stripe result in <Link className="underline" to="/admin/approvals">Approvals</Link>.</p>
        : item.express && item.breached && item.paid && <><p>The automatic worker checks each minute. A conflicting refund may need review.</p><button className="min-h-11 rounded border bg-white px-3" disabled={claim.isPending} onClick={() => claim.mutate({ applicationId: item.applicationId })}>Retry guarantee evaluation</button></>}
    </div>)}
    {claim.error && <p role="alert" className="mt-2 text-red-700">{claim.error.message}</p>}
  </section>;
}
