import { useState } from "react";
import { nationalityProductRules, type NationalityProductRule } from "@contracts/nationality-product";
import { trpc } from "@/providers/trpc-client";
import { NATIONALITY_CATALOG } from "../../../api/lib/requirements/nationality-catalog";

function EditConfiguration({ codes, version, rules }: { codes: string[]; version: number; rules: NationalityProductRule[] }) {
  const [rows, setRows] = useState(rules);
  const [ruleError, setRuleError] = useState("");
  const products = trpc.catalog.adminProducts.useQuery();
  const [selected, setSelected] = useState(codes);const [country, setCountry] = useState("");
  const utils = trpc.useUtils();
  const update = trpc.catalog.updateNationalityAvailability.useMutation({ onSuccess: () => { void utils.catalog.nationalityAvailability.invalidate(); } });
  return <form onSubmit={event => { event.preventDefault(); const parsed = nationalityProductRules.safeParse(rows);
    if (!parsed.success) { setRuleError("Choose a nationality, product and valid UTC start/end for every rule."); return; }
    setRuleError(""); update.mutate({ codes: selected, rules: parsed.data, expectedVersion: version }); }} className="space-y-3">
    <p className="text-sm text-slate-600">Owner configuration, not an independently verified authority restriction. Review against your own source before launch.</p>
    <ul>{selected.map(code => <li key={code} className="flex items-center justify-between gap-3"><span>{NATIONALITY_CATALOG.find(item => item.code === code)?.nameEn ?? code} ({code})</span><button type="button" disabled={update.isPending} className="min-h-11 underline" onClick={() => setSelected(selected.filter(item => item !== code))}>Remove</button></li>)}</ul>
    <label className="block">Nationality<select value={country} onChange={event => setCountry(event.target.value)} className="ms-3 min-h-11 rounded border p-2"><option value="">Select nationality</option>{NATIONALITY_CATALOG.filter(item => !selected.includes(item.code)).map(item => <option key={item.code} value={item.code}>{item.nameEn}</option>)}</select></label>
    <button type="button" disabled={!country || update.isPending} className="min-h-11 rounded border px-3" onClick={() => { setSelected([...selected, country]);setCountry(""); }}>Add to unavailable list</button>
    <h3 className="font-semibold">Product-specific unavailable windows (UTC)</h3>
    {rows.map((row, index) => <div key={index} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
      <label>Nationality<select value={row.nationality} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, nationality: event.target.value } : item))} className="block w-full border p-2">
        <option value="">Choose nationality</option>{NATIONALITY_CATALOG.map(item => <option key={item.code} value={item.code}>{item.nameEn}</option>)}
      </select></label>
      <label>Product<input list="availability-products" value={row.product} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, product: event.target.value } : item))} className="block w-full border p-2" /></label>
      <label>Start (ISO UTC)<input value={row.from} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, from: event.target.value } : item))} className="block w-full border p-2" /></label>
      <label>End (blank = ongoing)<input value={row.until ?? ""} onChange={event => setRows(rows.map((item, i) => i === index ? { ...item, until: event.target.value || null } : item))} className="block w-full border p-2" /></label>
      <button type="button" className="min-h-11 underline" onClick={() => setRows(rows.filter((_, i) => i !== index))}>Remove rule</button>
    </div>)}
    <datalist id="availability-products">{products.data?.map(product => <option key={product.serviceCode} value={product.serviceCode} />)}</datalist>
    <button type="button" className="min-h-11 rounded border px-3" onClick={() => setRows([...rows, { nationality: "", product: "", from: new Date().toISOString(), until: null }])}>Add product rule</button>
    {ruleError && <p role="alert">{ruleError}</p>}
    <button disabled={update.isPending} className="ms-3 min-h-11 rounded bg-slate-900 px-3 text-white">Save availability</button>
    {update.error && <p role="alert" className="text-red-700">{update.error.message}</p>}
  </form>;
}
export default function NationalityAvailabilitySettings() {
  const config = trpc.catalog.nationalityAvailability.useQuery();
  return <section className="mb-6 rounded-2xl border bg-white p-5"><h2 className="mb-3 text-lg font-bold">Nationalities currently unavailable</h2>
    {config.data && <EditConfiguration key={config.data.version} {...config.data} />}
    {config.isError && <p role="alert">Configuration could not load. <button className="underline" onClick={() => void config.refetch()}>Retry</button></p>}
  </section>;
}
