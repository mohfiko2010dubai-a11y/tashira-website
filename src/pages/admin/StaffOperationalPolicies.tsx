import { useMemo, useState } from "react";
import OperationalPolicyWorkspace from "@/components/operations/OperationalPolicyWorkspace";
import { OWNER_POLICY_V1_THRESHOLDS } from "@/components/operations/operational-policy-defaults";
import { trpc } from "@/providers/trpc-client";
import type { SubmissionPolicyThresholds } from "../../../api/lib/travel/operational-submission-policy";

const thresholdLabels: readonly [keyof SubmissionPolicyThresholds, string][] = [["scheduledAfterDays", "Scheduled after days"],
  ["recommendedMinDays", "Recommended minimum"], ["recommendedMaxDays", "Recommended maximum"], ["readyMinDays", "Ready minimum"],
  ["readyMaxDays", "Ready maximum"], ["urgentMinDays", "Urgent minimum"], ["urgentMaxDays", "Urgent maximum"],
  ["humanReviewMinDays", "Human review minimum"], ["humanReviewMaxDays", "Human review maximum"], ["dueSoonDays", "Due soon alert"],
  ["alertUrgentDays", "Urgent alert"], ["dueTodayDays", "Due today"]];

export default function StaffOperationalPolicies() {
  const utils = trpc.useUtils(); const policies = trpc.operationalPolicyGovernance.list.useQuery({}, { retry: false });
  const capabilities = trpc.operationalPolicyGovernance.capabilities.useQuery({}, { retry: false });
  const [selected, setSelected] = useState<string | null>(null); const [reason, setReason] = useState(""); const [showProposal, setShowProposal] = useState(false);
  const [draftThresholds, setDraftThresholds] = useState<SubmissionPolicyThresholds>(OWNER_POLICY_V1_THRESHOLDS);
  const selectedId = selected ?? policies.data?.[0]?.policyId ?? null;
  const history = trpc.operationalPolicyGovernance.history.useQuery({ policyId: selectedId ?? "00000000-0000-4000-8000-000000000000" }, { enabled: Boolean(selectedId), retry: false });
  const nextVersion = useMemo(() => Math.max(0, ...(policies.data ?? []).map((policy) => policy.version)) + 1, [policies.data]);
  const transition = trpc.operationalPolicyGovernance.transition.useMutation({ onSuccess: async () => { setReason(""); await Promise.all([
    utils.operationalPolicyGovernance.list.invalidate(), selectedId ? utils.operationalPolicyGovernance.history.invalidate({ policyId: selectedId }) : Promise.resolve()]); } });
  const propose = trpc.operationalPolicyGovernance.propose.useMutation({ onSuccess: async (created) => { setShowProposal(false); setReason(""); setSelected(created.policyId); await utils.operationalPolicyGovernance.list.invalidate(); } });
  if (policies.isLoading || capabilities.isLoading) return <main className="min-h-screen p-8 text-center">Loading operational policy governance…</main>;
  if (policies.isError || capabilities.isError || !policies.data || !capabilities.data || !capabilities.data.read) return <main className="min-h-screen p-8 text-center">Operational policy governance is unavailable for this scope.</main>;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-7xl"><header className="mb-6 rounded-2xl bg-slate-950 p-6 text-white">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Admin · Operations governance</p><h1 className="mt-2 text-2xl font-bold">Submission Policy</h1>
    <p className="mt-1 text-sm text-slate-300">Versioned, reviewed and auditable TASHIRA operational timing. Official eligibility rules remain separate.</p></header>
    {showProposal && capabilities.data.propose && <form className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5" onSubmit={(event) => { event.preventDefault(); propose.mutate({ version: nextVersion,
      thresholds: draftThresholds, effectiveFrom: new Date(), effectiveTo: null, sourceReference: "OWNER_APPROVED_OPERATIONAL_POLICY",
      reason: reason.trim() }); }}><h2 className="font-bold">Propose Version {nextVersion}</h2><p className="mt-1 text-sm text-slate-600">Starts as DRAFT using the owner-approved V1 thresholds. Review and activation remain separate permissioned actions.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{thresholdLabels.map(([key, label]) => <label key={key} className="text-xs font-semibold text-slate-600">{label}<input type="number" min={0} required value={draftThresholds[key]}
        onChange={(event) => setDraftThresholds((current) => ({ ...current, [key]: Number(event.target.value) }))}
        disabled={key === "dueTodayDays"} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm disabled:bg-slate-100" /></label>)}</div>
      <div className="mt-4 flex gap-2"><button disabled={reason.trim().length < 3 || propose.isPending} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Create draft</button>
        <button type="button" onClick={() => setShowProposal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button></div></form>}
    <OperationalPolicyWorkspace policies={policies.data} selectedPolicyId={selectedId} history={history.data ?? []} capabilities={capabilities.data}
      reason={reason} busy={transition.isPending || propose.isPending} onSelect={setSelected} onReason={setReason} onShowProposal={() => setShowProposal(true)}
      onTransition={(policy, state) => transition.mutate({ policyId: policy.policyId, expectedVersion: policy.recordVersion, toState: state, reason: reason.trim() })} />
  </div></main>;
}
