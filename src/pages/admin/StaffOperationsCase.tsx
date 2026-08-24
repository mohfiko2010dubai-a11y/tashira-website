import { Link, useParams } from "react-router-dom";
import { trpc } from "@/providers/trpc-client";
import OperationsCaseWorkspace from "@/components/operations/OperationsCaseWorkspace";

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
  return <OperationsCaseWorkspace enabled model={query.data} />;
}
