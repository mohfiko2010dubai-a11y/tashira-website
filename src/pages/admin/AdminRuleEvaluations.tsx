import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminTopNav from '@/components/admin/AdminTopNav';
import { trpc } from '@/providers/trpc-client';

type EvaluationRow = {
  evaluationId: string; referenceNumber: string; applicantId: number | null; routeCode: string;
  finalState: string; decisionReason: string | null; manualReviewReason: string | null;
  engineVersion: string; evaluatedAt: string;
};

/** Governed rule evaluation evidence — who was evaluated, against which route, and why. */
export default function AdminRuleEvaluations() {
  const [search, setSearch] = useState('');
  const query = trpc.ruleGovernance.recentEvaluations.useQuery({ limit: 100 });
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ((query.data ?? []) as EvaluationRow[]).filter((r) =>
      !q || r.referenceNumber.toLowerCase().includes(q) || r.routeCode.toLowerCase().includes(q) || r.finalState.toLowerCase().includes(q));
  }, [query.data, search]);

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <AdminTopNav title="Rule Evaluations" subtitle="Evidence" />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference, route or state…" className="mb-5 w-72 rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
        {query.isError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Evaluations unavailable or access denied.</p>}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr><th className="px-4 py-3 text-left">Application</th><th className="px-4 py-3">Applicant</th><th className="px-4 py-3 text-left">Route</th><th className="px-4 py-3">Outcome</th><th className="px-4 py-3 text-left">Reason</th><th className="px-4 py-3">Engine</th><th className="px-4 py-3 text-left">Evaluated at</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.evaluationId} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <Link to={`/admin/applications/${r.referenceNumber}`} className="font-mono text-xs font-bold text-[#C9A04C] hover:underline">{r.referenceNumber}</Link>
                  </td>
                  <td className="px-4 py-3 text-center text-xs">{r.applicantId ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.routeCode}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${r.finalState === 'ELIGIBLE_ROUTE_FOUND' ? 'bg-emerald-100 text-emerald-800' : r.finalState?.includes('HUMAN') || r.finalState?.includes('REVIEW') ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                      {r.finalState?.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td className="max-w-64 px-4 py-3 text-xs text-gray-600">{r.manualReviewReason ?? r.decisionReason ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-400">{r.engineVersion}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.evaluatedAt ? new Date(r.evaluatedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {query.data && rows.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No evaluations recorded yet.</p>}
        </div>
      </main>
    </div>
  );
}
