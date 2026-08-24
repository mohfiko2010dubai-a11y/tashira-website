import type { OperationsCaseReadModel } from "../../../api/lib/operations/case-read-model";
import { OperationsControlledWritePanelLive } from "./OperationsControlledWritePanel";

type Props = {
  enabled: boolean;
  model: OperationsCaseReadModel;
  writesEnabled?: boolean;
  onRefresh?: () => Promise<void>;
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

export default function OperationsCaseWorkspace({ enabled, model, writesEnabled = false, onRefresh }: Props) {
  if (!enabled) return null;
  const memberState = new Map(model.familyReadiness.member_states.map((member) => [member.applicant_id, member.readiness_state]));

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
            ["documents", "Documents"], ["history", "Evaluation History"], ["readiness", "Family Readiness"],
            ["timeline", "Timeline"], ["supplier", "Supplier"],
          ].map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full border bg-white px-3 py-1.5">{label}</a>)}
        </nav>

        {writesEnabled && onRefresh && <OperationsControlledWritePanelLive enabled model={model} onRefresh={onRefresh} />}

        <Section id="overview" title="Case Overview">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Reference</dt><dd className="font-medium">{model.summary.reference}</dd></div>
            <div><dt className="text-xs text-slate-500">Status</dt><dd className="font-medium">{model.summary.status}</dd></div>
            <div><dt className="text-xs text-slate-500">Created</dt><dd className="font-medium">{model.summary.createdAt}</dd></div>
          </dl>
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
