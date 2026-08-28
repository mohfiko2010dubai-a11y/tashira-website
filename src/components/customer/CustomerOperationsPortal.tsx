import type { CustomerOperationsPortal as PortalModel } from "../../../api/lib/customer/customer-operations-portal";

export default function CustomerOperationsPortal({ enabled, model }: { enabled: boolean; model: PortalModel }) {
  if (!enabled) return null;
  const terminal = new Set(["COMPLETED", "CANCELLED", "REJECTED"]).has(model.currentStatus.code);
  return (
    <main data-testid="customer-operations-portal" className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">Application {model.applicationReference}</p>
        <h1 className="mt-2 text-2xl font-bold">{model.currentStatus.code.replaceAll("_", " ")}</h1>
        <p className="mt-2 text-slate-200">{model.currentStatus.message}</p>
      </header>
      {model.requiredCustomerActions.length > 0 && <section aria-labelledby="customer-actions" className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 id="customer-actions" className="font-semibold">What you need to do</h2><ul className="mt-2 list-disc pl-5 text-sm">{model.requiredCustomerActions.map((action) => <li key={action}>{action}</li>)}</ul></section>}
      {!terminal && <nav aria-label="Application actions" className="flex flex-wrap gap-3 rounded-2xl border bg-white p-5 shadow-sm">
        <a href={`/apply/${encodeURIComponent(model.applicationReference)}/interview`} className="rounded-xl bg-[#cda64f] px-5 py-3 font-semibold text-slate-950">Resume application</a>
        <a href={`/pay/${encodeURIComponent(model.applicationReference)}`} className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-800">Review payment readiness</a>
      </nav>}
      <section aria-labelledby="applicant-progress"><h2 id="applicant-progress" className="text-lg font-semibold">Applicants</h2><div className="mt-3 grid gap-4 sm:grid-cols-2">{model.applicants.map((applicant) => <article key={applicant.applicantId} className="rounded-xl border bg-white p-4"><h3 className="font-semibold">{applicant.label}</h3><p className="text-sm text-slate-600">Requirements complete: {applicant.requirementSummary.complete} of {applicant.requirementSummary.total}</p></article>)}</div></section>
      {model.travel.length > 0 && <section aria-labelledby="travel-status"><h2 id="travel-status" className="text-lg font-semibold">Submission schedule</h2><div className="mt-3 space-y-3">{model.travel.map((travel) => <article key={travel.travelGroupId} className="rounded-xl border p-4"><strong>{travel.submissionState.replaceAll("_", " ")}</strong><p className="text-sm">{travel.explanation}</p><p className="text-xs text-slate-500">Planned travel: {travel.plannedArrivalDate}</p></article>)}</div></section>}
      <section aria-labelledby="application-timeline"><h2 id="application-timeline" className="text-lg font-semibold">Application timeline</h2><ol className="mt-3 space-y-3">{model.timeline.map((event) => <li key={event.eventId} className="border-l-2 border-amber-400 pl-4"><strong>{event.status.replaceAll("_", " ")}</strong><p className="text-sm text-slate-600">{event.message}</p><time className="text-xs text-slate-500">{event.occurredAt}</time></li>)}</ol></section>
    </main>
  );
}
