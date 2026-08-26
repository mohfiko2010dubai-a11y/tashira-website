import OperationsManagerDashboard from "@/components/operations/OperationsManagerDashboard";
import { trpc } from "@/providers/trpc-client";

export default function StaffOperationsDashboard() {
  const query = trpc.operationsRead.managerDashboard.useQuery({}, { retry: false });
  if (query.isLoading) return <main className="min-h-screen bg-slate-50 p-8 text-center">Loading Operations dashboard…</main>;
  if (query.isError || !query.data) return <main className="min-h-screen bg-slate-50 p-8 text-center">Operations manager dashboard unavailable for this scope.</main>;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-7xl">
    <header className="mb-6 rounded-2xl bg-slate-950 p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Operations</p>
      <h1 className="mt-2 text-2xl font-bold">Manager Dashboard</h1><p className="mt-1 text-sm text-slate-300">Scoped operational evidence without financial disclosure.</p></header>
    <OperationsManagerDashboard model={query.data} />
  </div></main>;
}
