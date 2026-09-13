import type { RuleDiagnostic } from "@contracts/document-requirement-engine";

export function ApplicationDocumentDiagnostics({ applicants }: { applicants: readonly {
  applicantId: number; label: string; suppressed: readonly RuleDiagnostic[]; unmatched: readonly RuleDiagnostic[];
}[] }) {
  return <section className="m-6 rounded-xl border bg-white p-4" aria-label="Application document rule diagnostics">
    <h2 className="font-bold">Document rule diagnostics</h2>
    {applicants.map(applicant => {
      const drafts = applicant.suppressed.filter(rule => rule.reason === "draft");
      return <div key={applicant.applicantId} className="mt-3 text-sm"><strong>{applicant.label}</strong>
        {drafts.length > 0 ? <p className="mt-1 rounded bg-amber-50 p-2 text-amber-900">{drafts.length} rules suppressed (draft): {drafts.map(rule => rule.key).join(", ")}</p>
          : <p>No applicable draft rules suppressed.</p>}
        <details className="mt-2"><summary>Other rule decisions ({applicant.unmatched.length} unmatched)</summary>
          <ul>{[...applicant.suppressed.filter(rule => rule.reason !== "draft"), ...applicant.unmatched].map((rule, index) => <li key={`${rule.key}-${index}`}>
            <code>{rule.key}</code>: {rule.reason} {rule.conditions?.join(", ")}</li>)}</ul>
        </details></div>;
    })}
  </section>;
}
