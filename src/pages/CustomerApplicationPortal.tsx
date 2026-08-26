import { useParams } from "react-router-dom";
import CustomerOperationsPortal from "@/components/customer/CustomerOperationsPortal";
import { trpc } from "@/providers/trpc-client";

export default function CustomerApplicationPortal() {
  const { referenceNumber = "" } = useParams();
  const query = trpc.customerOperations.portal.useQuery({ referenceNumber }, { enabled: referenceNumber.length >= 3, retry: false });
  if (query.isLoading) return <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-10" aria-live="polite">Loading your application status…</main>;
  if (query.error || !query.data) return <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-10"><section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
    <h1 className="text-xl font-semibold text-slate-950">Application status unavailable</h1>
    <p className="mt-2 text-slate-700">Use the secure application link sent to you, or contact TASHIRA support.</p>
  </section></main>;
  return <CustomerOperationsPortal enabled model={query.data} />;
}
