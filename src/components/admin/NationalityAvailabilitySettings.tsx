import { useState } from "react";
import { trpc } from "@/providers/trpc-client";
import { NATIONALITY_CATALOG } from "../../../api/lib/requirements/nationality-catalog";

function EditConfiguration({ codes, version }: { codes: string[]; version: number }) {
  const [selected, setSelected] = useState(codes);const [country, setCountry] = useState("");
  const utils = trpc.useUtils();
  const update = trpc.catalog.updateNationalityAvailability.useMutation({ onSuccess: () => { void utils.catalog.nationalityAvailability.invalidate(); } });
  return <form onSubmit={event => { event.preventDefault();update.mutate({ codes: selected, expectedVersion: version }); }} className="space-y-3">
    <p className="text-sm text-slate-600">Owner configuration, not an independently verified authority restriction. Review against your own source before launch.</p>
    <ul>{selected.map(code => <li key={code} className="flex items-center justify-between gap-3"><span>{NATIONALITY_CATALOG.find(item => item.code === code)?.nameEn ?? code} ({code})</span><button type="button" disabled={update.isPending} className="min-h-11 underline" onClick={() => setSelected(selected.filter(item => item !== code))}>Remove</button></li>)}</ul>
    <label className="block">Nationality<select value={country} onChange={event => setCountry(event.target.value)} className="ms-3 min-h-11 rounded border p-2"><option value="">Select nationality</option>{NATIONALITY_CATALOG.filter(item => !selected.includes(item.code)).map(item => <option key={item.code} value={item.code}>{item.nameEn}</option>)}</select></label>
    <button type="button" disabled={!country || update.isPending} className="min-h-11 rounded border px-3" onClick={() => { setSelected([...selected, country]);setCountry(""); }}>Add to unavailable list</button>
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
