import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminTopNav from '@/components/admin/AdminTopNav';
import { trpc } from '@/providers/trpc-client';

const STATUSES = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED', 'REJECTED'] as const;
const ACTIONS: Record<string, { action: 'SUBMIT_FOR_REVIEW' | 'APPROVE' | 'REJECT' | 'ACTIVATE' | 'RETIRE'; label: string }[]> = {
  DRAFT: [{ action: 'SUBMIT_FOR_REVIEW', label: 'Submit for review' }],
  UNDER_REVIEW: [{ action: 'APPROVE', label: 'Approve' }, { action: 'REJECT', label: 'Reject' }],
  APPROVED: [{ action: 'ACTIVATE', label: 'Activate (Staging)' }],
  ACTIVE: [{ action: 'RETIRE', label: 'Retire / rollback' }],
  RETIRED: [],
  REJECTED: [],
};

type RuleRow = {
  ruleVersionId: string; stableId: string; version: number; status: (typeof STATUSES)[number];
  classification: string; layer: string | null; sourceAuthority: string; sourceTitle: string; sourceUrl: string;
  sourceAuthorityDecision: string | null; eventId: string; fromStatus: string | null; toStatus: string;
  actorReference: string; reason: string; occurredAt: string;
};

export default function AdminVisaRules() {
  const { id } = useParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reason, setReason] = useState<Record<string, string>>({});
  const query = trpc.ruleGovernance.list.useQuery({});
  const transition = trpc.ruleGovernance.transition.useMutation({ onSuccess: () => query.refetch() });

  const rows = useMemo(() => {
    const all = (query.data ?? []) as RuleRow[];
    // Latest event per rule version defines its current status row set
    const q = search.trim().toLowerCase();
    return all.filter((r) =>
      (!statusFilter || r.status === statusFilter) &&
      (!q || r.stableId.toLowerCase().includes(q) || r.sourceAuthority.toLowerCase().includes(q) || r.sourceTitle.toLowerCase().includes(q)) &&
      (!id || r.ruleVersionId === id || r.stableId === id));
  }, [query.data, search, statusFilter, id]);

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <AdminTopNav title="Visa Rules" subtitle={id ? `Rule ${id}` : 'Governance'} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by rule, authority or source…"
            className="w-72 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-[#C9A04C] focus:outline-none"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
          </select>
          {id && <Link to="/admin/visa-rules" className="text-sm text-[#C9A04C] underline">← Back to all rules</Link>}
        </div>

        {query.isLoading && <p className="text-sm text-gray-500">Loading governed rules…</p>}
        {query.isError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Rule governance is unavailable or access was denied. Audit has been recorded.</p>}
        {transition.isError && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Transition rejected — check permissions, current status and concurrency, then refresh.</p>}

        <div className="space-y-3">
          {rows.map((rule) => (
            <article key={rule.eventId} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold text-[#0A1628]">{rule.stableId} <span className="text-gray-400">v{rule.version}</span></p>
                  <p className="mt-1 text-xs text-gray-500">
                    {rule.layer?.replaceAll('_', ' ') ?? '—'} · {rule.classification} · Source: {rule.sourceAuthority} — {rule.sourceTitle}
                  </p>
                  {rule.sourceUrl && <p className="mt-0.5 break-all text-[11px] text-gray-400">{rule.sourceUrl}</p>}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${rule.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : rule.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-700'}`}>
                  {rule.toStatus.replaceAll('_', ' ')}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {rule.fromStatus ? `${rule.fromStatus} → ` : ''}{rule.toStatus} by {rule.actorReference} at {new Date(rule.occurredAt).toLocaleString()} — {rule.reason}
              </p>
              {(ACTIONS[rule.toStatus] ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <input
                    value={reason[rule.ruleVersionId] ?? ''}
                    onChange={(e) => setReason((prev) => ({ ...prev, [rule.ruleVersionId]: e.target.value }))}
                    placeholder="Transition reason (required, audited)"
                    className="min-w-56 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs"
                  />
                  {(ACTIONS[rule.toStatus] ?? []).map(({ action, label }) => (
                    <button
                      key={action}
                      type="button"
                      disabled={transition.isPending || (reason[rule.ruleVersionId] ?? '').trim().length < 3}
                      onClick={() => transition.mutate({
                        ruleVersionId: rule.ruleVersionId,
                        expectedStatus: rule.toStatus as RuleRow['status'],
                        action,
                        reason: (reason[rule.ruleVersionId] ?? '').trim(),
                        commandId: crypto.randomUUID(),
                      })}
                      className={`rounded-lg px-4 py-2 text-xs font-bold ${action === 'REJECT' || action === 'RETIRE' ? 'border border-rose-200 text-rose-700 hover:bg-rose-50' : 'bg-[#C9A04C] text-white hover:opacity-90'} disabled:opacity-40`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
          {query.data && rows.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No governed rules match the current filters.</p>}
        </div>
        <p className="mt-6 text-xs text-gray-400">
          Published versions are immutable — corrections require a new governed version. Production activation additionally requires the owner gate.
        </p>
      </main>
    </div>
  );
}
