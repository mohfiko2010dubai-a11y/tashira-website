import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/providers/trpc-client";

export default function CustomerVisaDeliveries({ referenceNumber, applicants }: {
  referenceNumber: string;
  applicants: readonly { id: number; name: string }[];
}) {
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  const query = trpc.operationsVisaDelivery.customerList.useQuery({ applicationReference: referenceNumber }, { retry: false });
  const utils = trpc.useUtils();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState(false);
  async function download(deliveryId: string) {
    setPending(deliveryId);
    setError(false);
    try {
      const result = await utils.operationsVisaDelivery.customerDownload.fetch({ applicationReference: referenceNumber, deliveryId });
      window.location.assign(result.signedUrl);
    } catch {
      setError(true);
    } finally {
      setPending(null);
    }
  }
  if (query.isLoading) return <p role="status">{ar ? "جارٍ تحميل التأشيرات…" : "Loading visas…"}</p>;
  if (query.error) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p>{ar ? "تعذر تحميل التأشيرات. أعد المحاولة أو تواصل معنا." : "Unable to load your visas. Retry or contact us."}</p><button type="button" className="mt-2 underline" onClick={() => void query.refetch()}>{ar ? "إعادة المحاولة" : "Retry"}</button></div>;
  if (!query.data?.length) return null;
  return <section aria-label={ar ? "تأشيرات المسافرين" : "Traveller visas"} dir={ar ? "rtl" : "ltr"} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
    <h2 className="text-lg font-semibold text-emerald-950">{ar ? "تأشيراتك جاهزة للتنزيل" : "Your visas are ready to download"}</h2>
    <p className="mt-1 text-sm text-emerald-900">{ar ? "نزّل تأشيرة كل مسافر وراجع بياناتها وتعليماتها قبل السفر." : "Download each traveller’s visa and review its details and instructions before travelling."}</p>
    {error && <p role="alert" className="mt-3 text-red-700">{ar ? "تعذر تنزيل التأشيرة. حاول مرة أخرى أو تواصل معنا." : "Unable to download this visa. Try again or contact us."}</p>}
    <div className="mt-4 space-y-3">{query.data.map(delivery => <article key={delivery.deliveryId} className="space-y-3 rounded-xl bg-white p-4">
      <h3 className="font-semibold">{applicants.find(a => a.id === delivery.applicantId)?.name || (ar ? "المسافر" : "Traveller")}</h3>
      {delivery.visaReference && <p className="text-sm">{ar ? "رقم التأشيرة: " : "Visa number: "}<bdi>{delivery.visaReference}</bdi></p>}
      {delivery.validitySummary && <p className="text-sm">{ar ? "الصلاحية: " : "Validity: "}{delivery.validitySummary}</p>}
      <ul className="list-disc space-y-1 ps-5 text-sm">{delivery.customerInstructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ul>
      <button type="button" disabled={pending !== null} onClick={() => void download(delivery.deliveryId)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending === delivery.deliveryId ? (ar ? "جارٍ تجهيز التنزيل…" : "Preparing download…") : (ar ? "تنزيل التأشيرة" : "Download visa")}</button>
    </article>)}</div>
  </section>;
}
