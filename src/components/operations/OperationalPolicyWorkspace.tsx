import type { OperationalPolicyGovernanceView, OperationalPolicyHistoryView } from "../../../api/lib/travel/mysql-operational-policy-governance-repository";
import type { OperationalPolicyState } from "../../../api/lib/travel/operational-submission-policy";

export type PolicyCapabilities = { read: boolean; propose: boolean; review: boolean; activate: boolean };
const next: Readonly<Record<OperationalPolicyState, readonly OperationalPolicyState[]>> = {
  DRAFT: ["REVIEW"], REVIEW: ["APPROVED", "REJECTED"], APPROVED: ["ACTIVE"], ACTIVE: ["SUPERSEDED"], REJECTED: ["DRAFT"], SUPERSEDED: [],
};
function allowed(state: OperationalPolicyState, capabilities: PolicyCapabilities) {
  return next[state].filter((target) => target === "DRAFT" || target === "REVIEW" ? capabilities.propose
    : target === "APPROVED" || target === "REJECTED" ? capabilities.review : capabilities.activate);
}
function date(value: Date | string | null) { return value ? new Date(value).toLocaleString() : "—"; }

export default function OperationalPolicyWorkspace({ policies, selectedPolicyId, history, capabilities, reason, busy, onSelect,
  onReason, onTransition, onShowProposal }: { policies: readonly OperationalPolicyGovernanceView[]; selectedPolicyId: string | null;
  history: readonly OperationalPolicyHistoryView[]; capabilities: PolicyCapabilities; reason: string; busy: boolean;
  onSelect(id: string): void; onReason(value: string): void; onTransition(policy: OperationalPolicyGovernanceView, state: OperationalPolicyState): void;
  onShowProposal(): void }) {
  const active = policies.find((policy) => policy.state === "ACTIVE");
  return <section aria-label="Operational submission policy governance" className="space-y-6">
    <div className="grid gap-4 md:grid-cols-3"><article className="rounded-2xl border bg-white p-5 shadow-sm md:col-span-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current active policy</p>
      <h2 className="mt-2 text-xl font-bold">{active ? `Submission Scheduler V${active.version}` : "No active policy"}</h2>
      {active && <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Classification</dt><dd className="font-semibold">OPERATIONAL</dd></div>
        <div><dt className="text-slate-500">Effective from</dt><dd>{date(active.effectiveFrom)}</dd></div><div><dt className="text-slate-500">Record version</dt><dd>{active.recordVersion}</dd></div>
        <div><dt className="text-slate-500">Scheduled after</dt><dd>{active.thresholds.scheduledAfterDays} days</dd></div>
        <div><dt className="text-slate-500">Due soon</dt><dd>{active.thresholds.dueSoonDays} days</dd></div>
        <div><dt className="text-slate-500">Urgent alert</dt><dd>{active.thresholds.alertUrgentDays} days</dd></div></dl>}
    </article><aside className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Safety boundary</p>
      <p className="mt-3 text-sm text-slate-200">TASHIRA operational timing is not an official UAE eligibility or visa-validity rule. Historical evaluations remain immutable.</p>
      {capabilities.propose && <button type="button" onClick={onShowProposal} className="mt-5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950">Propose new version</button>}
    </aside></div>
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="space-y-3">{policies.map((policy) => <article key={policy.policyId} className="rounded-2xl border bg-white p-5 shadow-sm">
      <button type="button" onClick={() => onSelect(policy.policyId)} className="w-full text-left"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">Version {policy.version}</h3><p className="text-xs text-slate-500">{policy.sourceReference}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{policy.state}</span></div></button>
      <p className="mt-3 text-xs text-slate-500">Effective {date(policy.effectiveFrom)} · evidence {policy.evidenceSha256.slice(0, 12)}…</p>
      {allowed(policy.state, capabilities).length > 0 && <div className="mt-4 flex flex-wrap gap-2">{allowed(policy.state, capabilities).map((state) => <button key={state} type="button" disabled={busy || reason.trim().length < 3} onClick={() => onTransition(policy, state)} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">{state}</button>)}</div>}
    </article>)}</div><aside className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-bold">Immutable history</h2>
      <label className="mt-4 block text-xs font-semibold text-slate-600">Required reason<input value={reason} onChange={(event) => onReason(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Reason for governed action" /></label>
      <ol className="mt-5 space-y-4">{selectedPolicyId && history.length === 0 && <li className="text-sm text-slate-500">No history available.</li>}{history.map((event) => <li key={event.eventId} className="border-l-2 border-amber-300 pl-3"><p className="text-sm font-semibold">{event.fromState ?? "NEW"} → {event.toState}</p><p className="text-xs text-slate-500">{event.reason} · {date(event.occurredAt)}</p></li>)}</ol>
    </aside></div>
  </section>;
}
