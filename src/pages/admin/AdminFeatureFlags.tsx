import AdminTopNav from '@/components/admin/AdminTopNav';
import { trpc } from '@/providers/trpc-client';

type Flag = { flagKey: string; environment: string; enabled: boolean; scopeType: string; scopeReference: string };

/** Staging-only feature flags (read-only). Production flags are never shown or editable here. */
export default function AdminFeatureFlags() {
  const query = trpc.ruleGovernance.stagingFeatureFlags.useQuery({});
  const flags = (query.data ?? []) as Flag[];

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <AdminTopNav title="Feature Flags" subtitle="Staging only" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This screen lists <strong>Staging</strong> flags only. Production flags are never displayed or modified here.
          Flag changes follow the governed operations change process with audit evidence — this view is read-only.
        </div>
        {query.isError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Feature flags unavailable or access denied.</p>}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr><th className="px-4 py-3 text-left">Flag</th><th className="px-4 py-3">Environment</th><th className="px-4 py-3">Value</th><th className="px-4 py-3 text-left">Scope</th></tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={`${f.flagKey}-${f.scopeType}-${f.scopeReference}`} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-[#0A1628]">{f.flagKey}</td>
                  <td className="px-4 py-3 text-center"><span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-800">{f.environment}</span></td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${f.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                      {f.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{f.scopeType}{f.scopeReference ? `: ${f.scopeReference}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {query.data && flags.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No Staging flags defined.</p>}
        </div>
      </main>
    </div>
  );
}
