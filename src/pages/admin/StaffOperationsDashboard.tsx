import OperationsManagerDashboard from "@/components/operations/OperationsManagerDashboard";
import { trpc } from "@/providers/trpc-client";
import { Link } from "react-router-dom";
import OperationsShell from "@/components/operations/OperationsShell";

export default function StaffOperationsDashboard() {
  const query = trpc.operationsRead.managerDashboard.useQuery({}, { retry: false });
  if (query.isLoading) return <main className="min-h-screen bg-slate-50 p-8 text-center">Loading Operations dashboard…</main>;
  if (query.isError || !query.data) return <main className="min-h-screen bg-slate-50 p-8 text-center">Operations dashboard unavailable for this permission scope.</main>;
  return <OperationsShell title="Operations Dashboard" subtitle="Live scoped workload, readiness, deadlines and review signals.">
    <div className="mb-5 flex flex-wrap gap-2"><Link to="/staff/dashboard" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Open applications</Link>
      <Link to="/staff/operations" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Submission queue</Link></div>
    <OperationsManagerDashboard model={query.data} />
  </OperationsShell>;
}
