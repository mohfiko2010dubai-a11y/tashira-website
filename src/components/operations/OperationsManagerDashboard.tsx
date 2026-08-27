import type { OperationsManagerDashboard as DashboardModel } from "../../../api/lib/operations/manager-analytics";

const metrics: readonly { key: keyof DashboardModel; label: string }[] = [
  { key: "openCases", label: "Open cases" }, { key: "waitingForCustomer", label: "Waiting for customer" },
  { key: "scheduledSubmissions", label: "Scheduled submissions" }, { key: "dueToday", label: "Due today" },
  { key: "overdue", label: "Overdue" }, { key: "readyForSubmission", label: "Ready for submission" },
  { key: "authorityQueries", label: "Authority queries" }, { key: "rework", label: "Document rework" },
  { key: "documentIntelligenceEscalations", label: "Document intelligence escalations" },
  { key: "manualReviewApplicants", label: "Applicants in manual review" },
  { key: "manualReviewRatePercent", label: "Manual review rate (%)" },
];

export default function OperationsManagerDashboard({ model }: { model: DashboardModel }) {
  return <section aria-label="Operations manager dashboard" className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(({ key, label }) => <article key={key}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{String(model[key])}</p></article>)}</div>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Employee workload</h2>
        {model.employeeWorkload.length === 0 ? <p className="mt-3 text-sm text-slate-500">No assigned open cases.</p> : <ul className="mt-3 divide-y">{model.employeeWorkload.map((item) =>
          <li key={item.staffId} className="flex justify-between py-3 text-sm"><span>Staff #{item.staffId}</span><span>{item.openCases} open</span></li>)}</ul>}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Supplier operational performance</h2>
        <p className="mt-1 text-xs text-slate-500">Operational outcomes only. Financial fields are not available in this view.</p>
        {model.supplierOperationalPerformance.length === 0 ? <p className="mt-3 text-sm text-slate-500">No supplier cases.</p> : <ul className="mt-3 divide-y">{model.supplierOperationalPerformance.map((item) =>
          <li key={item.supplierId} className="py-3 text-sm"><strong>Supplier #{item.supplierId}</strong><span className="ml-3">{item.caseCount} cases · {item.issued} issued · {item.rejected} rejected</span></li>)}</ul>}</section>
    </div>
  </section>;
}
