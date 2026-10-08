import OperationsManagerDashboard from "@/components/operations/OperationsManagerDashboard";
import { trpc } from "@/providers/trpc-client";
import { Link } from "react-router-dom";
import OperationsShell from "@/components/operations/OperationsShell";

export default function StaffOperationsDashboard() {
  const query = trpc.operationsRead.managerDashboard.useQuery({}, { retry: false });
  if (query.isLoading) return <OperationsShell title="Operations Dashboard"><p role="status">Loading Operations dashboard…</p></OperationsShell>;
  if (query.isError || !query.data) return <OperationsShell title="Operations Dashboard">
    <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="font-semibold">{query.error?.data?.code === 'FORBIDDEN' ? 'This dashboard is not available for your role.' : 'The dashboard could not be loaded.'}</h2>
      <p className="mt-2">Open Applications to continue your work. If access is missing, ask your administrator to check your assigned role and work scope.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/staff/dashboard" className="rounded-lg bg-slate-950 px-4 py-2 text-white">Open applications</Link>
        {query.error?.data?.code !== 'FORBIDDEN' && <button type="button" onClick={() => void query.refetch()} className="rounded-lg border border-slate-300 bg-white px-4 py-2">Try again</button>}
      </div>
    </div>
  </OperationsShell>;
  return <OperationsShell title="Operations Dashboard" subtitle="Live scoped workload, readiness, deadlines and review signals.">
    <div className="mb-5 flex flex-wrap gap-2"><Link to="/staff/dashboard" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Open applications</Link>
      <Link to="/staff/operations" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Submission queue</Link></div>
    <OperationsManagerDashboard model={query.data} />
  </OperationsShell>;
}
