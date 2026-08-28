import { Link, useParams } from "react-router-dom";
import { trpc } from "@/providers/trpc-client";
import OperationsCaseWorkspace from "@/components/operations/OperationsCaseWorkspace";
import SchedulerAlertPanel from "@/components/operations/SchedulerAlertPanel";
import { OperationsControlledWritePanelLive } from "@/components/operations/OperationsControlledWritePanel";
import OperationsShell from "@/components/operations/OperationsShell";
import DocumentManager from "@/components/shared/DocumentManager";
import VisaDeliveryPanel from "@/components/operations/VisaDeliveryPanel";
import CaseNotePanel from "@/components/operations/CaseNotePanel";

export default function StaffOperationsCase() {
  const { referenceNumber = "" } = useParams<{ referenceNumber: string }>();
  const query = trpc.operationsRead.caseByReference.useQuery(
    { reference: referenceNumber },
    { enabled: referenceNumber.length > 0, retry: false },
  );

  if (query.isLoading) return <main className="min-h-screen bg-slate-50 p-8 text-center">Loading Operations case…</main>;
  if (query.isError || !query.data) return (
    <main className="min-h-screen bg-slate-50 p-8">
      <section className="mx-auto max-w-xl rounded-xl border bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Operations case unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">This workspace is disabled or your Operations scope does not permit this case.</p>
        <Link className="mt-4 inline-block text-sm font-semibold text-amber-700" to="/staff/dashboard">Back to dashboard</Link>
      </section>
    </main>
  );
  return <OperationsShell title={`Case ${query.data.summary.reference}`} subtitle="Applicant-isolated requirements, evidence, review and controlled actions.">
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600" aria-label="Breadcrumb">
      <Link to="/staff/operations/dashboard" className="hover:text-amber-700">Operations</Link><span>/</span>
      <Link to="/staff/dashboard" className="hover:text-amber-700">Applications</Link><span>/</span>
      <span className="font-semibold text-slate-950">{query.data.summary.reference}</span>
    </div>
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Case quick actions">
      <a href="#document-files" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">View & download documents</a>
      <a href="#actions" className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950">Employee actions</a>
      <a href="#timeline" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Case timeline</a>
    </nav>
    <div className="space-y-6">
      <OperationsControlledWritePanelLive enabled model={query.data} onRefresh={async () => { await query.refetch(); }} />
      <OperationsCaseWorkspace enabled model={query.data} embedded />
      <section id="document-files" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Secure document viewer</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">Preview or download the files attached to this case. Destructive document controls are disabled in the Operations workspace.</p>
        <DocumentManager applicationId={query.data.summary.applicationId} readOnly allowUpload applicants={query.data.applicants.map((applicant) => ({ applicantId: applicant.applicantId, displayName: applicant.displayName }))} />
      </section>
      <VisaDeliveryPanel applicationId={query.data.summary.applicationId} applicationReference={query.data.summary.reference} applicants={query.data.applicants.map((applicant) => ({ applicantId: applicant.applicantId, displayName: applicant.displayName }))} />
      <CaseNotePanel referenceNumber={query.data.summary.reference} onRecorded={async () => { await query.refetch(); }} />
      <SchedulerAlertPanel applicationId={query.data.summary.applicationId} />
    </div>
  </OperationsShell>;
}
