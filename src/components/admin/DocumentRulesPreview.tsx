import { useState } from "react";
import NationalitySelect from "@/components/customer/NationalitySelect";
import { DOCUMENT_REQUIREMENT_RULES, flattenDocumentRules, requiredDocuments, tripPurposeSchema, type TripPurpose } from "@contracts/document-requirement-engine";

export function DocumentRulesPreview() {
  const [nationality, setNationality] = useState("PK");
  const [residence, setResidence] = useState("SA");
  const [visa, setVisa] = useState("30days");
  const [purpose, setPurpose] = useState<TripPurpose>("tourism");
  const [all, setAll] = useState(false);
  const [companion, setCompanion] = useState(false);
  const preview = requiredDocuments({ nationality, country_of_residence: residence, visa_type: visa, trip_purpose: purpose, residence_type: companion ? "gcc-accompany" : "gcc-resident" }, { previewDrafts: true });
  const rules = flattenDocumentRules(all ? DOCUMENT_REQUIREMENT_RULES : preview);
  return <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="document-rules-title">
    <h2 id="document-rules-title" className="text-xl font-bold">Document requirements — publication preview</h2>
    <p className="mt-2 text-sm text-slate-600">Approved rules are requested from customers. Draft rules below are for review only and do not block upload completion or payment.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <NationalitySelect compact label="Nationality" value={nationality} onChange={setNationality} />
      <NationalitySelect compact purpose="residence" label="Country of residence" value={residence} onChange={setResidence} />
      <label className="grid gap-2 text-sm">Visa type<select aria-label="Visa type" value={visa} onChange={event => setVisa(event.target.value)} className="rounded-xl border p-2">
        <option value="30days">30-day visit visa</option><option value="60days">60-day visit visa</option><option value="transit">Transit visa</option></select></label>
      <label className="grid gap-2 text-sm">Trip purpose<select aria-label="Trip purpose" value={purpose} onChange={event => setPurpose(tripPurposeSchema.parse(event.target.value))} className="rounded-xl border p-2">
        <option value="tourism">Tourism</option><option value="visiting_family">Visiting family</option><option value="transit">Transit</option></select></label>
    </div>
    <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={companion} onChange={event => setCompanion(event.target.checked)} />GCC Resident Accompanying</label>
    <p className="mt-4 text-sm" aria-live="polite">{preview.filter(rule => rule.status === "approved").length} approved customer requirements · {preview.filter(rule => rule.status === "draft" && !rule.placeholder).length} draft requirements · {preview.filter(rule => rule.placeholder).length} wording placeholders</p>
    <label className="my-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} />Show all rule rows</label>
    <div className="overflow-x-auto"><table className="w-full text-start text-sm">
      <thead><tr className="border-b text-start"><th className="p-2 text-start">Document key</th><th className="p-2 text-start">English / العربية</th><th className="p-2 text-start">Applies when</th><th className="p-2 text-start">Status</th></tr></thead>
      <tbody>{rules.map(rule => <tr key={rule.key} className="border-b align-top">
        <td className="p-2 font-mono text-xs">{rule.key}{rule.any_of && <p>ANY OF — one slot</p>}{rule.all_of && <p>ALL OF</p>}</td>
        <td className="p-2"><strong>{rule.label_en}</strong><p dir="rtl">{rule.label_ar}</p><p className="mt-1 text-xs text-slate-500">{rule.hint_en}</p><p dir="rtl" className="text-xs text-slate-500">{rule.hint_ar}</p></td>
        <td className="p-2 text-xs">{Object.keys(rule.applies_when).length ? JSON.stringify(rule.applies_when) : "All applicants"}</td>
        <td className="p-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${rule.status === "draft" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{rule.placeholder ? "DRAFT — wording pending" : rule.status.toUpperCase()}</span></td>
      </tr>)}</tbody>
    </table></div>
    <p className="mt-4 text-xs text-slate-500">Rule source: contracts/document-requirement-rules.json. Edit the labelled rows there, review the preview and tests, then publish the reviewed change. A wording placeholder cannot be approved until its wording is resolved.</p>
  </section>;
}
