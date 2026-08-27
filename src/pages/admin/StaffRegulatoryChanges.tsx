import { useRef, useState } from "react";
import RegulatoryChangeWorkspace from "@/components/operations/RegulatoryChangeWorkspace";
import { trpc } from "@/providers/trpc-client";

export default function StaffRegulatoryChanges() {
  const utils = trpc.useUtils();
  const query = trpc.operationsRegulatory.list.useQuery({}, { retry: false });
  const history = trpc.ruleGovernance.list.useQuery({}, { retry: false });
  const mutation = trpc.operationsRegulatory.review.useMutation({ onSuccess: () => utils.operationsRegulatory.list.invalidate() });
  const [reason, setReason] = useState("");
  const keys = useRef(new Map<string, string>());
  function key(scope: string) {
    const old = keys.current.get(scope);
    if (old) return old;
    const value = crypto.randomUUID();
    keys.current.set(scope, value);
    return value;
  }
  if (query.isLoading || history.isLoading) return <main className="min-h-screen p-8 text-center">Loading Regulatory Change Center…</main>;
  if (query.isError || !query.data || history.isError || !history.data)
    return <main className="min-h-screen p-8 text-center">Regulatory Change Center is unavailable.</main>;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-6xl">
    <header className="mb-6 rounded-2xl bg-slate-950 p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Rules governance</p>
      <h1 className="mt-2 text-2xl font-bold">Regulatory Change Center</h1><p className="mt-1 text-sm text-slate-300">Human review only. No proposal can automatically activate a rule.</p></header>
    <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Immutable Rule Registry</p><h2 className="text-lg font-semibold">Version lifecycle evidence</h2></div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">Read-only</span></div>
      <p className="mt-2 text-sm text-slate-600">Source authority and every recorded state transition are shown without exposing activation controls.</p>
      {history.data.length === 0 ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">No governed lifecycle evidence is available.</p> :
        <div className="mt-4 space-y-3">{history.data.map(event => <article key={event.eventId} className="rounded-xl border p-4">
          <div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-semibold">{event.stableId} · v{event.version}</h3>
            <p className="text-xs text-slate-600">{event.classification} · {event.layer ?? "LEGACY_LAYER_UNKNOWN"}</p></div>
            <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold">{event.fromStatus ?? "CREATED"} → {event.toStatus}</span></div>
          <p className="mt-2 text-sm">{event.reason}</p><p className="mt-1 text-xs text-slate-500">{event.occurredAt} · {event.actorReference}</p>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs"><p className="font-semibold">{event.sourceAuthority}: {event.sourceTitle}</p>
            <p>Source review: {event.sourceAuthorityDecision ?? "NOT_REVIEWED"}</p><a href={event.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">Open source evidence</a></div>
        </article>)}</div>}
    </section>
    <RegulatoryChangeWorkspace items={query.data} busy={mutation.isPending} reason={reason} onReason={setReason}
      onReview={(item, decision) => mutation.mutate({ changeId: item.changeId, decision, expectedVersion: item.version, reason: reason.trim(), commandId: key(`${item.changeId}:${item.version}:${decision}`) })}/>
  </div></main>;
}
