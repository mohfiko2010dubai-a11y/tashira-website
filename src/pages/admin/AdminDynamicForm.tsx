import { useMemo, useState } from 'react';
import AdminTopNav from '@/components/admin/AdminTopNav';
import { trpc } from '@/providers/trpc-client';

type CatalogItem = {
  definitionId: string; kind: 'REQUIREMENT' | 'QUESTION'; code: string; version: number; state: string;
  recordVersion: number; customerLabel: string; classification: string; effectiveFrom: string; effectiveTo: string | null;
};

const STEP_OF: Record<string, string> = {
  APPLICATION_TYPE: 'Travel', NATIONALITY: 'Details', PASSPORT_COUNTRY: 'Details', RESIDENCE_COUNTRY: 'Residence',
  RESIDENCE_TYPE: 'Residence', GCC_RESIDENT: 'Residence', GCC_COUNTRY: 'Residence', RESIDENCE_EXPIRY: 'Residence',
  PROFESSION: 'Details', DATE_OF_BIRTH: 'Details', INSIDE_OUTSIDE_UAE: 'Details',
  PLANNED_ARRIVAL_DATE: 'Travel', PLANNED_DEPARTURE_DATE: 'Travel', HAS_CONFIRMED_TICKETS: 'Travel',
  TRAVELLING_TOGETHER: 'Travel',
};

/** Read-only governed view of the Dynamic Form configuration: steps, questions, scope, state and versions. */
export default function AdminDynamicForm() {
  const [search, setSearch] = useState('');
  const query = trpc.catalogGovernance.list.useQuery({});
  const questions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ((query.data ?? []) as CatalogItem[])
      .filter((i) => i.kind === 'QUESTION')
      .filter((i) => !q || i.code.toLowerCase().includes(q) || i.customerLabel.toLowerCase().includes(q));
  }, [query.data, search]);

  const steps = useMemo(() => {
    const grouped = new Map<string, CatalogItem[]>();
    for (const item of questions) {
      const step = STEP_OF[item.code] ?? 'Details';
      grouped.set(step, [...(grouped.get(step) ?? []), item]);
    }
    return [...grouped.entries()];
  }, [questions]);

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <AdminTopNav title="Dynamic Form" subtitle="Configuration" />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search question code or label…" className="w-72 rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
          <span className="rounded-full bg-[#C9A04C]/10 px-3 py-1 text-xs font-bold text-[#C9A04C]">{questions.length} governed questions</span>
        </div>
        {query.isError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Form configuration unavailable or access denied.</p>}

        <div className="space-y-5">
          {steps.map(([step, items]) => (
            <section key={step} className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#C9A04C]">Step: {step}</h2>
              <ul className="mt-3 divide-y divide-gray-100">
                {items.map((item) => (
                  <li key={`${item.definitionId}-${item.version}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-[#0A1628]">{item.code}</p>
                      <p className="text-sm text-gray-600">{item.customerLabel}</p>
                      <p className="text-[11px] text-gray-400">
                        Scope: {item.code === 'TRAVELLING_TOGETHER' ? 'whole application' : 'per applicant'} ·
                        Classification: {item.classification} · Effective {new Date(item.effectiveFrom).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">v{item.version}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${item.state === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{item.state}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-6 text-xs text-gray-400">
          Questions are shown to customers only when an ACTIVE governed rule requires them; conditions and document mappings come from the Visa Rules engine.
          Draft/publish and rollback follow the governed catalog lifecycle (see Catalogs → Documents).
        </p>
      </main>
    </div>
  );
}
