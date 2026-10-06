import { Link } from "react-router-dom";
import { trpc } from "@/providers/trpc-client";

export function OverdueCustomerWaits() {
  const query = trpc.refund.overdueWaitingOrders.useQuery(undefined, { refetchInterval: 60_000 });
  return <section className="my-4 rounded-xl border bg-white p-4" aria-label="Orders waiting on customers">
    <h2 className="font-semibold">Customer responses overdue ({query.data?.length ?? 0})</h2>
    <p className="text-sm">Oldest first. These orders remain visible while their submission clock is paused.</p>
    {query.isLoading && <p role="status">Loading paused orders…</p>}
    {query.error && <p role="alert">Paused orders could not load. <button className="underline" onClick={() => void query.refetch()}>Retry</button></p>}
    {query.data?.map(item => <article key={item.applicationId} className="mt-3 border-t pt-3">
      <Link className="break-all underline" to={`/admin/applications/${item.referenceNumber}`}>{item.referenceNumber}</Link>
      <p>Waiting since {new Date(item.pausedSince).toLocaleString()} · threshold {item.thresholdHours} hours</p>
      <p>{item.reasons.join(", ")}</p>
    </article>)}
    {query.data?.length === 0 && <p>No customer waits exceed the configured threshold.</p>}
  </section>;
}
