import type { OperationsCaseReadModel } from "../../../api/lib/operations/case-read-model";

type Props = {
  enabled: boolean;
  model: OperationsCaseReadModel;
};

function Section(props: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={props.id} aria-labelledby={`${props.id}-title`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id={`${props.id}-title`} className="mb-4 text-lg font-semibold text-slate-900">{props.title}</h2>
      {props.children}
    </section>
  );
}

function StateBadge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{children}</span>;
}

export default function OperationsCaseWorkspace({ enabled, model }: Props) {
  if (!enabled) return null;
  const memberState = new Map(model.familyReadiness.member_states.map((member) => [member.applicant_id, member.readiness_state]));
  const travelGroups = model.travelGroups ?? [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6" data-testid="operations-case-workspace">
        <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Operations Case Workspace · Read only</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{model.summary.reference}</h1>
              <p className="mt-1 text-sm text-slate-300">Application #{model.summary.applicationId}</p>
            </div>
            <StateBadge>{model.summary.status}</StateBadge>
          </div>
        </header>

        {model.mode === "LEGACY_NOT_EVALUATED" && (
          <aside role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <strong>LEGACY_NOT_EVALUATED</strong>
            <p className="mt-1 text-sm">No historical eligibility evaluation has been invented. Relationship details require review.</p>
          </aside>
        )}

        <nav aria-label="Case workspace sections" className="flex flex-wrap gap-2 text-sm">
          {[
            ["overview", "Case Overview"], ["applicants", "Applicants"], ["requirements", "Requirements"],
            ["travel-party", "Travel Party"], ["submission-schedule", "Submission Schedule"],
            ["scheduler-alerts", "Scheduler Alerts"],
            ["documents", "Documents"], ["history", "Evaluation History"], ["readiness", "Family Readiness"],
            ["timeline", "Timeline"], ["supplier", "Supplier"],
          ].map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full border bg-white px-3 py-1.5">{label}</a>)}
        </nav>

        <Section id="overview" title="Case Overview">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Reference</dt><dd className="font-medium">{model.summary.reference}</dd></div>
            <div><dt className="text-xs text-slate-500">Status</dt><dd className="font-medium">{model.summary.status}</dd></div>
            <div><dt className="text-xs text-slate-500">Created</dt><dd className="font-medium">{model.summary.createdAt}</dd></div>
          </dl>
        </Section>

        <Section id="scheduler-alerts" title="Scheduler Alerts">
          {(model.schedulerAlerts ?? []).length === 0 ? <p className="text-sm text-slate-500">No current operational alerts.</p> : (
            <div className="space-y-3">{(model.schedulerAlerts ?? []).map((alert) => (
              <article key={alert.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><strong>{alert.type}</strong><p className="text-xs text-slate-500">Travel group {alert.travelGroupId}</p></div>
                  <div className="flex gap-2"><StateBadge>{alert.severity}</StateBadge><StateBadge>{alert.state}</StateBadge></div>
                </div>
                <p className="mt-2 text-sm">{alert.reason}</p>
                <p className="mt-2 text-xs text-slate-500">Version {alert.version} · {alert.occurredAt}</p>
              </article>
            ))}</div>
          )}
        </Section>

        <Section id="travel-party" title="Travel Party">
          {travelGroups.length === 0 ? <p className="text-sm text-slate-500">NOT_EVALUATED — no travel group has been recorded.</p> : (
            <div className="grid gap-4 lg:grid-cols-2">{travelGroups.map((group) => (
              <article key={group.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex justify-between gap-3"><h3 className="font-semibold">{group.reference}</h3><StateBadge>{group.arrangement}</StateBadge></div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-slate-500">Travellers</dt><dd>{group.applicantIds.map((id) => model.applicants.find((item) => item.applicantId === id)?.displayName ?? `Applicant ${id}`).join(", ")}</dd></div>
                  <div><dt className="text-slate-500">Ticket</dt><dd>{group.ticketStatus}</dd></div>
                  <div><dt className="text-slate-500">Planned arrival</dt><dd>{group.plannedArrivalDate}</dd></div>
                  <div><dt className="text-slate-500">Planned departure</dt><dd>{group.plannedDepartureDate ?? "Not recorded"}</dd></div>
                </dl>
                {group.sharedDocuments.length > 0 && <p className="mt-3 text-xs text-slate-500">Shared booking links: {group.sharedDocuments.length}</p>}
              </article>
            ))}</div>
          )}
        </Section>

        <Section id="submission-schedule" title="Submission Schedule">
          <div className="space-y-4">{travelGroups.map((group) => (
            <article key={group.id} className="rounded-xl bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{group.reference}</h3><StateBadge>{group.currentSchedule?.state ?? "NOT_EVALUATED"}</StateBadge></div>
              {group.currentSchedule && <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-slate-500">Target submission</dt><dd>{group.currentSchedule.targetSubmissionDate ?? "Not established"}</dd></div>
                <div><dt className="text-slate-500">Latest safe date</dt><dd>{group.currentSchedule.latestSafeSubmissionDate ?? "Not established"}</dd></div>
                <div><dt className="text-slate-500">Blocking issues</dt><dd>{group.currentSchedule.blockingReasons.join(", ") || "None"}</dd></div>
                <div className="sm:col-span-3"><dt className="text-slate-500">Reason</dt><dd>{group.currentSchedule.reason}</dd></div>
                <div className="sm:col-span-3"><dt className="text-slate-500">Previous evaluations</dt><dd>{group.scheduleHistory.length}</dd></div>
              </dl>}
            </article>
          ))}</div>
        </Section>

        <Section id="applicants" title="Applicants">
          <div className="grid gap-4 lg:grid-cols-2">
            {model.applicants.map((applicant) => (
              <article key={applicant.applicantId} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-semibold">{applicant.displayName}</h3><p className="text-sm text-slate-500">Applicant {applicant.applicantIndex + 1}</p></div>
                  <StateBadge>{memberState.get(applicant.applicantId) ?? "NOT_EVALUATED"}</StateBadge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-slate-500">Nationality</dt><dd>{applicant.nationality ?? "Not recorded"}</dd></div>
                  <div><dt className="text-slate-500">Residence</dt><dd>{applicant.residenceCountry ?? "Not recorded"}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold">Family relationships</h3>
            {model.relationships.length === 0 ? <p className="mt-2 text-sm text-slate-500">No relationship graph recorded.</p> : (
              <ul className="mt-2 space-y-1 text-sm">{model.relationships.map((relationship, index) => (
                <li key={"id" in relationship ? relationship.id : `${relationship.applicantId}:${index}`}>
                  {"applicantId" in relationship
                    ? `Applicant ${relationship.applicantId}: ${relationship.relationship}`
                    : `Applicant ${relationship.fromApplicantId} → Applicant ${relationship.toApplicantId}: ${relationship.relationship}`}
                </li>
              ))}</ul>
            )}
          </div>
        </Section>

        <Section id="requirements" title="Requirements">
          <div className="space-y-4">
            {model.applicants.map((applicant) => (
              <article key={applicant.applicantId} className="rounded-xl bg-slate-50 p-4">
                <h3 className="font-semibold">{applicant.displayName}</h3>
                {applicant.dynamicRequirements.length === 0 ? <p className="mt-2 text-sm text-slate-500">No evaluated requirements available.</p> : (
                  <ul className="mt-2 space-y-2 text-sm">{applicant.dynamicRequirements.map(({ instance, currentState }) => (
                    <li key={instance.id} className="flex justify-between gap-3"><span>{instance.code}</span><StateBadge>{currentState ?? "NOT_RECORDED"}</StateBadge></li>
                  ))}</ul>
                )}
              </article>
            ))}
          </div>
        </Section>

        <Section id="documents" title="Documents">
          <div className="space-y-4">{model.applicants.map((applicant) => (
            <article key={applicant.applicantId}><h3 className="font-semibold">{applicant.displayName}</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">{applicant.documents.map((document) => (
                <li key={document.documentId} className="flex justify-between rounded-lg border p-3 text-sm"><span>{document.code}</span><StateBadge>{document.readiness}</StateBadge></li>
              ))}</ul>
            </article>
          ))}</div>
        </Section>

        <Section id="history" title="Evaluation History">
          <div className="space-y-5">{model.applicants.map((applicant) => (
            <article key={applicant.applicantId} className="border-l-2 border-amber-400 pl-4">
              <h3 className="font-semibold">{applicant.displayName}</h3>
              {applicant.currentEvaluation ? <div className="mt-2 text-sm">
                <p><strong>Current:</strong> {applicant.currentEvaluation.evaluationId} · {applicant.currentEvaluation.eligibilityState}</p>
                <p><strong>Rule versions:</strong> {applicant.currentRuleVersions.map((rule) => `${rule.ruleId} v${rule.version}`).join(", ") || "None"}</p>
                <p><strong>Re-evaluation reason:</strong> {applicant.evaluationChange?.reason ?? "Initial evaluation"}</p>
                <p><strong>Changed:</strong> {applicant.evaluationChange?.changedFields.join(", ") || "No prior snapshot"}</p>
                <p><strong>Previous:</strong> {applicant.previousEvaluations.map((item) => item.evaluationId).join(", ") || "None"}</p>
              </div> : <p className="mt-2 text-sm text-amber-800">NOT_EVALUATED</p>}
            </article>
          ))}</div>
        </Section>

        <Section id="readiness" title="Family Readiness">
          <div className="flex flex-wrap items-center gap-3"><StateBadge>{model.familyReadiness.family_readiness_state}</StateBadge>
            {model.familyReadiness.manual_review_required && <span className="text-sm font-semibold text-amber-700">Manual review required</span>}
          </div>
          <ul className="mt-4 space-y-2 text-sm">{model.familyReadiness.blocking_reasons.map((reason) => (
            <li key={`${reason.applicant_id}:${reason.code}`} className="rounded-lg bg-rose-50 p-3 text-rose-900">Applicant {reason.applicant_id}: {reason.reason}</li>
          ))}</ul>
          {model.familyReadiness.required_customer_actions.length > 0 && <div className="mt-4">
            <h3 className="text-sm font-semibold">Required customer actions</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{model.familyReadiness.required_customer_actions.map((action) => (
              <li key={`${action.applicant_id}:${action.action}`}>Applicant {action.applicant_id}: {action.action}</li>
            ))}</ul>
          </div>}
        </Section>

        <Section id="timeline" title="Timeline">
          <ol className="space-y-3">{model.operationalHistory.map((event) => (
            <li key={event.id} className="grid gap-1 border-l-2 border-slate-200 pl-4 text-sm sm:grid-cols-[1fr_auto]">
              <span>{event.event} · {event.actorType}</span><time>{event.occurredAt}</time>
            </li>
          ))}</ol>
        </Section>

        <Section id="supplier" title="Supplier">
          {model.supplier ? <dl className="grid gap-4 sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Supplier</dt><dd className="font-medium">{model.supplier.name}</dd></div>
            <div><dt className="text-xs text-slate-500">SLA</dt><dd>{model.supplier.slaHours === null ? "Not recorded" : `${model.supplier.slaHours} hours`}</dd></div>
            <div><dt className="text-xs text-slate-500">Reliability</dt><dd>{model.supplier.reliabilityScore ?? "Not recorded"}</dd></div>
          </dl> : <p className="text-sm text-slate-500">Supplier identity is unavailable for this role.</p>}
        </Section>
      </div>
    </main>
  );
}
