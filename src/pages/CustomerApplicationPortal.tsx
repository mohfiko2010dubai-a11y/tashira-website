import { useParams } from "react-router-dom";
import CustomerOperationsPortal from "@/components/customer/CustomerOperationsPortal";
import { trpc } from "@/providers/trpc-client";

export default function CustomerApplicationPortal() {
  const { referenceNumber = "" } = useParams();
  const query = trpc.customerOperations.portal.useQuery({ referenceNumber }, { enabled: referenceNumber.length >= 3, retry: false });
  const deliveries = trpc.operationsVisaDelivery.customerList.useQuery({ applicationReference: referenceNumber }, { enabled: referenceNumber.length >= 3, retry: false });
  const utils = trpc.useUtils();
  if (query.isLoading) return <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-10" aria-live="polite">Loading your application status…</main>;
  if (query.error || !query.data) return <main className="mx-auto min-h-[60vh] max-w-3xl px-4 py-10"><section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
    <h1 className="text-xl font-semibold text-slate-950">Application status unavailable</h1>
    <p className="mt-2 text-slate-700">Use the secure application link sent to you, or contact TASHIRA support.</p>
  </section></main>;
  return <><CustomerOperationsPortal enabled model={query.data} />{deliveries.data && deliveries.data.length > 0 && <section className="mx-auto mb-10 max-w-5xl rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="text-lg font-semibold text-emerald-950">Issued visas</h2><p className="mt-1 text-sm text-emerald-900">Download only the visa files securely prepared for this application.</p><div className="mt-4 space-y-3">{deliveries.data.map((delivery) => <article key={delivery.deliveryId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4"><div><strong>{delivery.visaReference}</strong><p className="text-sm text-slate-600">{delivery.validitySummary}</p></div><button type="button" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={async () => { const result = await utils.operationsVisaDelivery.customerDownload.fetch({ applicationReference: referenceNumber, deliveryId: delivery.deliveryId }); window.location.assign(result.signedUrl); }}>Download visa</button></article>)}</div></section>}</>;
}
