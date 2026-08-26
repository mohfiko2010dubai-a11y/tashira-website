type PrecheckResult = {
  outcome: "LIKELY_ELIGIBLE" | "LIKELY_NOT_ELIGIBLE" | "HUMAN_REVIEW_REQUIRED";
  requiredDocumentCodes: readonly string[];
  conditionalDocumentCodes: readonly string[];
  warnings: readonly string[];
  disclaimer: string;
  sourceVerificationStatus: "VERIFIED" | "NOT_RESEARCHED" | "HUMAN_REVIEW_REQUIRED";
};

const labels = { LIKELY_ELIGIBLE: "Likely eligible", LIKELY_NOT_ELIGIBLE: "May not be eligible", HUMAN_REVIEW_REQUIRED: "Human review required" } as const;

export default function CustomerPrecheckResult({ result }: { result: PrecheckResult }) {
  return <section aria-live="polite" className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Source status: {result.sourceVerificationStatus.replaceAll("_", " ")}</p>
    <h2 className="mt-2 text-2xl font-semibold text-slate-950">{labels[result.outcome]}</h2>
    {result.requiredDocumentCodes.length > 0 && <div className="mt-5"><h3 className="font-semibold text-slate-900">Likely required documents</h3><ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-700">{result.requiredDocumentCodes.map(code=><li key={code}>{code.replaceAll("_", " ")}</li>)}</ul></div>}
    {result.conditionalDocumentCodes.length > 0 && <div className="mt-5"><h3 className="font-semibold text-slate-900">May be required</h3><ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-700">{result.conditionalDocumentCodes.map(code=><li key={code}>{code.replaceAll("_", " ")}</li>)}</ul></div>}
    {result.warnings.map(warning=><p key={warning} className="mt-3 text-sm text-amber-900">{warning}</p>)}
    <p className="mt-5 border-t border-amber-200 pt-4 text-sm text-slate-700">{result.disclaimer}</p>
  </section>;
}
