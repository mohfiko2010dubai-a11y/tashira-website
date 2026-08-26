import { useState } from "react";
import type { PartyApplicant, PartyRequirementReadiness } from "./InterviewPartySetup";

type Props = { applicants: readonly PartyApplicant[]; requirements: readonly PartyRequirementReadiness[]; busy: boolean;
  error: boolean; onUpload: (requirement: PartyRequirementReadiness, file: File) => Promise<void> };

export function InterviewRequirementDocuments({ applicants, requirements, busy, error, onUpload }: Props) {
  const [selected, setSelected] = useState<Record<string, File | undefined>>({});
  if (!requirements.length) return null;
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="requirement-documents-heading">
    <p className="text-sm font-semibold uppercase tracking-wide text-[#9b7425]">Documents</p>
    <h2 id="requirement-documents-heading" className="mt-1 text-2xl font-bold text-slate-950">Applicant document requirements</h2>
    <p className="mt-2 text-sm text-slate-600">Each upload is stored and linked only to the applicant shown below.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">We could not link that document. The owned upload remains available for support review; please try again.</p>}
    <div className="mt-5 grid gap-4">{applicants.map((applicant) => { const own = requirements.filter((item) => item.applicantId === applicant.applicantId);
      if (!own.length) return null;
      return <article key={applicant.applicantId} className="rounded-2xl border border-slate-200 p-4" aria-label={`${applicant.fullName} documents`}>
        <h3 className="font-semibold text-slate-950">{applicant.fullName}</h3><div className="mt-3 grid gap-3">{own.map((requirement) => {
          const key = `${requirement.applicantId}:${requirement.requirementCode}`; const complete = ["UPLOADED", "VALIDATED", "WAIVED"].includes(requirement.state);
          return <div key={key} className="rounded-xl bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{requirement.requirementCode.replaceAll("_", " ")}</strong>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{requirement.state.replaceAll("_", " ")}</span></div>
            {!complete && <div className="mt-3 flex flex-wrap items-center gap-2"><input type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy}
              onChange={(event) => setSelected({ ...selected, [key]: event.target.files?.[0] })} className="max-w-full text-sm" />
              <button type="button" disabled={busy || !selected[key]} className="rounded-lg bg-[#cda64f] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                onClick={async () => { const file = selected[key]; if (!file) return; await onUpload(requirement, file);
                  setSelected((current) => ({ ...current, [key]: undefined })); }}>Upload</button></div>}</div>; })}</div>
      </article>; })}</div>
  </section>;
}
