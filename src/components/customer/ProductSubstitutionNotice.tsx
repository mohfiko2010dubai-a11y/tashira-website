import { useTranslation } from "react-i18next";
import { trpc } from "@/providers/trpc-client";

export function ProductSubstitutionNotice({ referenceNumber }: { referenceNumber: string }) {
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith("ar");
  const application = trpc.application.getByReference.useQuery({ referenceNumber });
  const quote = trpc.application.visaChangeQuote.useQuery({ referenceNumber });
  const acknowledge = trpc.application.acknowledgeSubmittedProduct.useMutation({ onSuccess: () => { void application.refetch(); void quote.refetch(); } });
  const app = application.data;
  if (!app?.submittedProduct || (!quote.data && app.submittedProduct === app.visaType)) return null;
  const accepted = app.substitutionVersion === app.substitutionAcknowledgedVersion;
  const price = quote.data?.version === app.substitutionVersion ? quote.data : null;
  const money = (minor: number) => `${(minor / 100).toFixed(2)} ${price?.currency || "USD"}`;
  return <section className="my-4 rounded border border-amber-300 bg-amber-50 p-4">
    <h2 className="font-semibold">{ar ? "تغيير التأشيرة المقترح" : "Proposed visa change"}</h2>
    <p>{ar ? "التأشيرة المشتراة" : "Purchased visa"}: {app.visaType}</p>
    <p>{ar ? "التأشيرة المقترحة للتقديم" : "Proposed visa for filing"}: {app.submittedProduct}</p>
    <p>{app.submittedReason}</p>
    {price ? <div className="my-3">
      <p>{ar ? "الإجمالي السابق" : "Previous total"}: {money(price.oldTotalMinor)}</p>
      <p>{ar ? "الإجمالي الجديد" : "New total"}: {money(price.newTotalMinor)}</p>
      <p>{price.differenceMinor > 0 ? (ar ? "فرق مطلوب دفعه" : "Additional payment") : price.differenceMinor < 0 ? (ar ? "فرق يُرد إليك" : "Refund to you") : (ar ? "لا يوجد فرق سعر" : "No price difference")}: {money(Math.abs(price.differenceMinor))}</p>
      {price.differenceMinor > 0 && <p>{ar ? "بعد دفع الفرق، تصدر فاتورة جديدة بقيمة الفرق فقط. تظل فاتورتك الأصلية دون تغيير." : "After payment, a separate invoice is issued for the difference only. Your original invoice remains unchanged."}</p>}
      {accepted && price.state !== "SETTLED" && <p role="status">{ar ? "تم تسجيل موافقتك؛ تسوية فرق السعر لم تكتمل بعد." : "Your agreement is recorded; the price difference has not yet been settled."}</p>}
    </div> : <p role="status">{ar ? "نحتاج عرض سعر حديث لهذا التعديل. تواصل مع الدعم قبل الموافقة." : "This change needs a current price proposal. Contact support before agreeing."}</p>}
    <p>{ar ? "لن نُقدّم التأشيرة البديلة قبل إقرارك بهذا التغيير." : "We will not file the replacement visa before you acknowledge this change."}</p>
    {accepted ? <p>{ar ? "تم تسجيل إقرارك." : "Your acknowledgement is recorded."}</p> : <button disabled={acknowledge.isPending || !price} className="mt-3 rounded bg-slate-900 px-4 py-3 text-white" onClick={() => { if (price) acknowledge.mutate({ referenceNumber, version: app.substitutionVersion, quoteId: price.id }); }}>
      {ar ? "أوافق على تعديل التأشيرة وفرق السعر الموضّح" : "I agree to the visa change and price difference shown"}
    </button>}
    {acknowledge.error && <p role="alert">{acknowledge.error.message}</p>}
    {quote.error && <p role="alert">{quote.error.message}</p>}
  </section>;
}
