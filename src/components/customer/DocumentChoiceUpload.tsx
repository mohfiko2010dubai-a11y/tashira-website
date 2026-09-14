import Logo from '@/components/shared/Logo';
import { useState } from "react";
import { requirementSatisfied, type DocumentRequirementRule } from "@contracts/document-requirement-engine";
import { DOCUMENT_INPUT_ACCEPT } from "@contracts/document-upload-policy";

/** One outer requirement card; choices and conjunctions are rendered recursively from data. */
export function DocumentChoiceUpload({ rule, uploadedCodes, disabled, ar, onUpload }: {
  rule: DocumentRequirementRule; uploadedCodes: readonly string[]; disabled: boolean; ar: boolean;
  onUpload: (leaf: DocumentRequirementRule, file: File) => void;
}) {
  const [selection, setSelection] = useState("");
  const label = ar ? rule.label_ar : rule.label_en;
  if (rule.any_of) {
    const chosen = rule.any_of.find(child => child.key === selection);
    return <fieldset className="grid gap-3" disabled={disabled}><legend className="text-sm font-medium">{ar ? "اختر مستندًا واحدًا" : "Choose one document"}</legend>
      {rule.any_of.map(child => <label key={child.key} className="flex items-center gap-2 text-sm">
        <input type="radio" name={`choice-${rule.key}`} checked={selection === child.key} onChange={() => setSelection(child.key)} />
        {ar ? child.label_ar : child.label_en}</label>)}
      {chosen && <DocumentChoiceUpload key={chosen.key} rule={chosen} uploadedCodes={uploadedCodes} disabled={disabled} ar={ar} onUpload={onUpload} />}
    </fieldset>;
  }
  if (rule.all_of) return <div className="grid gap-3"><p className="text-sm">{ar ? "جميع المستندات التالية مطلوبة" : "All the following documents are required"}</p>
    {rule.all_of.map(child => <DocumentChoiceUpload key={child.key} rule={child} uploadedCodes={uploadedCodes} disabled={disabled} ar={ar} onUpload={onUpload} />)}</div>;
  if (requirementSatisfied(rule, new Set(uploadedCodes))) return <p className="text-sm text-emerald-800"><Logo variant="mark-only" size={20} /> {label} — {ar ? "تم الاستلام" : "Received"}</p>;
  return <label className="grid gap-2 text-sm">{label}<span className="text-xs text-slate-600">{ar ? rule.hint_ar : rule.hint_en}</span>
    <input type="file" aria-label={label} accept={DOCUMENT_INPUT_ACCEPT} disabled={disabled}
      onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(rule, file); }} className="max-w-full text-sm" />
  </label>;
}
