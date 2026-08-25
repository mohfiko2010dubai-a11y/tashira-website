import type { DynamicCustomerApplicationPlan } from "../../../api/lib/customer/dynamic-application-plan";

type Props = { enabled: boolean; plan: DynamicCustomerApplicationPlan };

const classificationLabel = {
  AUTHORITY_REQUIRED: "Required by authority",
  TASHIRA_PROCESSING: "Required for TASHIRA processing",
  MAY_BE_REQUIRED: "May be required",
  OPTIONAL: "Optional",
} as const;

export default function DynamicApplicationReview({ enabled, plan }: Props) {
  if (!enabled) return null;
  return (
    <section aria-labelledby="dynamic-application-title" data-testid="dynamic-application-review" className="space-y-6">
      <header>
        <p className="text-sm font-medium text-amber-700">{plan.mode === "FAMILY" ? "Family application" : "Individual application"}</p>
        <h2 id="dynamic-application-title" className="text-2xl font-bold">Review applicants and requirements</h2>
        <p className="text-sm text-slate-600">Every document stays linked to the applicant shown below.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {plan.applicants.map((applicant) => (
          <article key={applicant.applicantId} className="rounded-2xl border bg-white p-5 shadow-sm" aria-label={applicant.displayLabel}>
            <h3 className="font-semibold">{applicant.displayLabel}</h3>
            <p className="text-xs uppercase text-slate-500">{applicant.relationship.replaceAll("_", " ")}</p>
            {applicant.questions.length > 0 && <div className="mt-4"><h4 className="text-sm font-semibold">Questions</h4><ul className="mt-2 list-disc pl-5 text-sm">{applicant.questions.map((question) => <li key={question.code}>{question.prompt}</li>)}</ul></div>}
            <div className="mt-4"><h4 className="text-sm font-semibold">Documents</h4>{applicant.uploads.length === 0 ? <p className="mt-2 text-sm text-slate-500">No upload requested by the current evaluation.</p> : <ul className="mt-2 space-y-2">{applicant.uploads.map((upload) => <li key={upload.code} className="rounded-lg bg-slate-50 p-3 text-sm"><strong>{upload.label ?? upload.code}</strong><span className="block text-xs text-slate-500">{classificationLabel[upload.classification]}</span></li>)}</ul>}</div>
          </article>
        ))}
      </div>
      {plan.travelGroups.length > 0 && <div><h3 className="font-semibold">Travel groups</h3><div className="mt-2 grid gap-3 sm:grid-cols-2">{plan.travelGroups.map((group) => <article key={group.travelGroupId} className="rounded-xl border p-4"><strong>{group.label}</strong><p className="text-sm text-slate-600">{group.applicantIds.map((id) => plan.applicants.find((item) => item.applicantId === id)?.displayLabel).filter(Boolean).join(", ")}</p></article>)}</div></div>}
      {plan.schedules.map((schedule) => <aside key={schedule.travelGroupId} className="rounded-xl border border-amber-200 bg-amber-50 p-4"><strong>{schedule.submissionState.replaceAll("_", " ")}</strong><p className="mt-1 text-sm">{schedule.customerExplanation}</p><p className="mt-1 text-xs text-slate-600">Planned travel: {schedule.plannedTravelDate}</p></aside>)}
    </section>
  );
}
