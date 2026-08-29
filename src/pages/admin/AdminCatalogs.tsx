import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminTopNav from '@/components/admin/AdminTopNav';
import { trpc } from '@/providers/trpc-client';

const CATALOG_SECTIONS = [
  { to: '/admin/catalogs/visa-products', title: 'Visa Products', desc: 'Service codes, entry types and validity per product' },
  { to: '/admin/catalogs/pricing', title: 'Pricing Versions', desc: 'Government/service fees, VAT, effective dates and version history' },
  { to: '/admin/catalogs/documents', title: 'Document Types & Requirements', desc: 'Governed requirement definitions, classifications and lifecycle' },
] as const;

type CatalogItem = {
  definitionId: string; kind: 'REQUIREMENT' | 'QUESTION'; code: string; version: number; state: string;
  recordVersion: number; customerLabel: string; classification: string; effectiveFrom: string; effectiveTo: string | null;
};

type PricingRow = {
  id: number; serviceCode: string; processingType: string; version: number; sellingPrice: string | number; promotionalPrice?: string | number | null; currency: string;
  supplierCost: string | number; internalCost: string | number; markup: string | number; minimumSellingPrice: string | number;
  effectiveAt: string | Date; expiresAt: string | Date | null; createdAt: string | Date;
};

function CatalogDocuments() {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const query = trpc.catalogGovernance.list.useQuery({});
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ((query.data ?? []) as CatalogItem[])
      .filter((i) => i.kind === 'REQUIREMENT')
      .filter((i) => (!stateFilter || i.state === stateFilter) && (!q || i.code.toLowerCase().includes(q) || i.customerLabel.toLowerCase().includes(q)));
  }, [query.data, search, stateFilter]);
  const states = useMemo(() => [...new Set(((query.data ?? []) as CatalogItem[]).filter((i) => i.kind === 'REQUIREMENT').map((i) => i.state))].sort(), [query.data]);

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or label…" className="w-72 rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm">
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {query.isError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Catalog unavailable or access denied.</p>}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr><th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3 text-left">Label</th><th className="px-4 py-3 text-left">Classification</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">State</th><th className="px-4 py-3 text-left">Effective</th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={`${i.definitionId}-${i.version}`} className="border-t border-gray-100">
                <td className="px-4 py-3 font-mono text-xs font-bold text-[#0A1628]">{i.code}</td>
                <td className="px-4 py-3">{i.customerLabel}</td>
                <td className="px-4 py-3 text-xs">{i.classification}</td>
                <td className="px-4 py-3 text-center">v{i.version}</td>
                <td className="px-4 py-3 text-center"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${i.state === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{i.state}</span></td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(i.effectiveFrom).toLocaleDateString()}{i.effectiveTo ? ` → ${new Date(i.effectiveTo).toLocaleDateString()}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.data && items.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No requirement definitions match.</p>}
      </div>
    </>
  );
}

function CatalogPricing() {
  const query = trpc.business.pricingHistory.useQuery();
  const rows = (query.data ?? []) as PricingRow[];
  return (
    <>
      {query.isError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Pricing catalog unavailable or access denied.</p>}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr><th className="px-4 py-3 text-left">Service</th><th className="px-4 py-3">Processing</th><th className="px-4 py-3">Version</th><th className="px-4 py-3">Unit price</th><th className="px-4 py-3">Supplier cost</th><th className="px-4 py-3">Min selling</th><th className="px-4 py-3 text-left">Effective</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-3 font-mono text-xs font-bold">{r.serviceCode}</td>
                <td className="px-4 py-3 text-center capitalize">{r.processingType}</td>
                <td className="px-4 py-3 text-center">v{r.version}</td>
                <td className="px-4 py-3 text-center font-bold text-[#0A1628]">{String(r.sellingPrice)} {r.currency}</td>
                <td className="px-4 py-3 text-center text-xs text-gray-500">{r.supplierCost}</td>
                <td className="px-4 py-3 text-center text-xs text-gray-500">{r.minimumSellingPrice}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.effectiveAt).toLocaleDateString()}{r.expiresAt ? ` → ${new Date(r.expiresAt).toLocaleDateString()}` : ' → open'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.data && rows.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No pricing versions recorded.</p>}
      </div>
      <p className="mt-4 text-xs text-gray-400">Published pricing versions are immutable; corrections require a new version. Production prices change only through the governed owner flow.</p>
    </>
  );
}

function CatalogVisaProducts() {
  const query = trpc.business.pricingHistory.useQuery();
  const products = useMemo(() => {
    const rows = (query.data ?? []) as PricingRow[];
    const latest = new Map<string, PricingRow[]>();
    for (const row of rows) {
      const list = latest.get(row.serviceCode) ?? [];
      if (!list.some((x) => x.processingType === row.processingType)) list.push(row);
      latest.set(row.serviceCode, list);
    }
    return [...latest.entries()].map(([serviceCode, variants]) => ({ serviceCode, variants }));
  }, [query.data]);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <article key={p.serviceCode} className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="font-mono text-sm font-bold text-[#0A1628]">{p.serviceCode}</p>
          <ul className="mt-3 space-y-1 text-sm text-gray-600">
            {p.variants.map((v) => (
              <li key={v.processingType} className="flex justify-between"><span className="capitalize">{v.processingType}</span><strong>{String(v.sellingPrice)} {v.currency}</strong></li>
            ))}
          </ul>
        </article>
      ))}
      {query.data && products.length === 0 && <p className="col-span-full py-8 text-center text-sm text-gray-400">No visa products priced yet.</p>}
    </div>
  );
}

export default function AdminCatalogs() {
  const { section } = useParams();
  const title = section === 'pricing' ? 'Pricing Versions' : section === 'documents' ? 'Document Types & Requirements' : section === 'visa-products' ? 'Visa Products' : 'Catalogs';
  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <AdminTopNav title="Catalogs" subtitle={title} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {section && <Link to="/admin/catalogs" className="mb-5 inline-block text-sm text-[#C9A04C] underline">← All catalogs</Link>}
        {!section && (
          <div className="grid gap-4 sm:grid-cols-3">
            {CATALOG_SECTIONS.map((c) => (
              <Link key={c.to} to={c.to} className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md">
                <h2 className="font-bold text-[#0A1628]">{c.title}</h2>
                <p className="mt-2 text-sm text-gray-500">{c.desc}</p>
              </Link>
            ))}
          </div>
        )}
        {section === 'documents' && <CatalogDocuments />}
        {section === 'pricing' && <CatalogPricing />}
        {section === 'visa-products' && <CatalogVisaProducts />}
      </main>
    </div>
  );
}
