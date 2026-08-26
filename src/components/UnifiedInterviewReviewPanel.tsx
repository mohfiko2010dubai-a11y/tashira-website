type ApplicantReview = {
  applicantId: number;
  label: string;
  relationship: string;
  eligibilityState: string;
  requirements: readonly {
    code: string;
    label: string | null;
    state: "REQUIRED" | "CONDITIONAL";
    classification: string;
    reason: string;
  }[];
  warnings: readonly string[];
};

export type UnifiedInterviewReviewModel = {
  applicants: readonly ApplicantReview[];
  travelGroups: readonly { travelGroupId: string; label: string; applicantIds: readonly number[]; plannedArrivalDate: string | null }[];
  sharedDocuments: readonly { documentId: string; type: string; linkedApplicantIds: readonly number[]; missingApplicantIds: readonly number[] }[];
  schedules: readonly { travelGroupId: string; state: string; plannedArrivalDate: string; targetSubmissionDate: string | null; explanation: string }[];
  blockingReasons: readonly string[];
  manualReviewRequired: boolean;
};

function readable(value: string): string { return value.replaceAll("_", " "); }

export function UnifiedInterviewReviewPanel({ review }: { review: UnifiedInterviewReviewModel }) {
  const applicants = new Map(review.applicants.map((applicant) => [applicant.applicantId, applicant.label]));
  return <section className="mt-6 space-y-5" aria-label="Complete application review">
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="font-semibold text-slate-950">Applicant outcomes</h3>
      <div className="mt-4 space-y-4">{review.applicants.map((applicant) => <article key={applicant.applicantId}
        className="rounded-xl border border-slate-200 bg-white p-4" data-applicant-id={applicant.applicantId}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><h4 className="font-semibold text-slate-950">{applicant.label}</h4><p className="text-sm text-slate-500">{readable(applicant.relationship)}</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{readable(applicant.eligibilityState)}</span>
        </div>
        <ul className="mt-3 space-y-2">{applicant.requirements.map((requirement) => <li key={`${applicant.applicantId}-${requirement.code}`}
          className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-medium text-slate-900">{requirement.label ?? readable(requirement.code)}</span>
          <span className="ml-2 text-xs text-[#8a6721]">{readable(requirement.state)}</span><span className="mt-1 block text-xs text-slate-600">{requirement.reason}</span></li>)}</ul>
        {applicant.warnings.length > 0 && <ul className="mt-3 space-y-1 text-sm text-amber-800">{applicant.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      </article>)}</div>
    </div>
    {review.travelGroups.length > 0 && <div className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold text-slate-950">Travel party</h3>
      <ul className="mt-3 space-y-3 text-sm">{review.travelGroups.map((group) => <li key={group.travelGroupId}><span className="font-medium">{group.label}</span>
        <span className="block text-slate-600">{group.applicantIds.map((id) => applicants.get(id) ?? "Applicant").join(", ")}{group.plannedArrivalDate ? ` · Arrival ${group.plannedArrivalDate}` : ""}</span></li>)}</ul></div>}
    {review.schedules.length > 0 && <div className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold text-slate-950">Submission timing</h3>
      <ul className="mt-3 space-y-3 text-sm">{review.schedules.map((schedule) => <li key={schedule.travelGroupId}><span className="font-medium">{readable(schedule.state)}</span>
        <span className="block text-slate-600">{schedule.explanation}</span></li>)}</ul></div>}
    {review.sharedDocuments.some((document) => document.missingApplicantIds.length > 0) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h3 className="font-semibold text-amber-950">Shared document coverage</h3><ul className="mt-2 space-y-2 text-sm text-amber-900">{review.sharedDocuments.filter((document) => document.missingApplicantIds.length > 0)
        .map((document) => <li key={document.documentId}>{readable(document.type)} still needs linking for {document.missingApplicantIds.map((id) => applicants.get(id) ?? "Applicant").join(", ")}.</li>)}</ul></div>}
    {(review.blockingReasons.length > 0 || review.manualReviewRequired) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h3 className="font-semibold text-amber-950">Before you continue</h3><ul className="mt-2 space-y-1 text-sm text-amber-900">{review.blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}
        {review.manualReviewRequired && <li>A TASHIRA specialist must review this application.</li>}</ul></div>}
  </section>;
}
