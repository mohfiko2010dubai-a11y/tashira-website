import { useState } from "react";
import { trpc } from "@/providers/trpc-client";

export function ManualVisaChange({ referenceNumber }: { referenceNumber: string }) {
  const query = trpc.application.visaChangeQuote.useQuery({ referenceNumber }, { refetchInterval: 15000 });
  const request = trpc.application.requestManualChange.useMutation();
  const link = trpc.application.createDifferenceLink.useMutation();
  const [outcome, setOutcome] = useState<"FULL_REFUND_CANCEL" | "REFUND_LESS_FEE" | "TRY_ANOTHER_PRODUCT" | "ORIGINAL_AT_CUSTOMER_REQUEST">("TRY_ANOTHER_PRODUCT");
  const [message, setMessage] = useState("");
  const quote = query.data;
  if (query.error) return <p role="alert">تعذر تحميل تفاصيل التعديل. حدّث الصفحة قبل تسجيل التسوية.</p>;
  if(quote?.state==="SETTLED" || (quote && quote.state!=="REFUSED" && quote.differenceMinor>=0))return null;
  if (!quote || !["REFUSED", "ACCEPTED", "PAYMENT_PENDING", "REFUND_PENDING"].includes(quote.state)) return null;
  const refused = quote.state === "REFUSED";
  const financial = !refused || ["FULL_REFUND_CANCEL", "REFUND_LESS_FEE"].includes(outcome);
  return <section dir="rtl" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
    <h3 className="font-bold">تسوية فرق السعر أو معالجة رفض العميل</h3>
    <p>إصدار العرض {quote.version} · {({ REFUSED: "رفض العميل", ACCEPTED: "وافق العميل", PAYMENT_PENDING: "بانتظار دفع الفرق", REFUND_PENDING: "بانتظار رد الفرق" } as Record<string, string>)[quote.state] || quote.state} · فرق السعر {(quote.differenceMinor / 100).toFixed(2)} {quote.currency}</p>
    {!refused && quote.differenceMinor > 0 && <div className="space-y-3">
      <p>بعد دفع العميل يؤكد Stripe استلام الفرق تلقائيًا وتصدر فاتورة مستقلة. لا تحتاج إعادة تأكيد الدفع.</p>
      {quote.paymentLink ? <a className="underline" href={quote.paymentLink} target="_blank" rel="noreferrer">فتح رابط دفع الفرق</a> : <button className="min-h-11 rounded-lg bg-slate-900 px-4 text-white" disabled={link.isPending} onClick={async()=>{
        try { await link.mutateAsync({referenceNumber,quoteId:quote.id,version:quote.version});await query.refetch();setMessage('تم إنشاء رابط فرق السعر وإضافة رسالة العميل إلى قائمة الإرسال.'); }
        catch(error){setMessage(error instanceof Error?error.message:'تعذر إنشاء الرابط. أعد المحاولة.');}
      }}>{link.isPending?'جارٍ إنشاء الرابط…':'إنشاء وإرسال رابط دفع الفرق'}</button>}
    </div>}
    {(refused || quote.differenceMinor < 0) && <>
    <p>سجّل حركة الاسترداد المنفّذة في Stripe أو القرار المطلوب بعد رفض العميل.</p>
    <form className="space-y-3" onSubmit={async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      try {
        await request.mutateAsync({ referenceNumber, quoteId: quote.id, version: quote.version, kind: refused ? "REFUSAL_OUTCOME" : "SETTLEMENT",
          ...(refused ? { outcome } : {}), ...(financial ? { amountMinor: Math.round(Number(data.get("amount")) * 100), currency: "USD" as const,
            direction: !refused && quote.differenceMinor > 0 ? "TOP_UP" as const : "REFUND" as const, stripeReference: String(data.get("reference")) } : {}),
          reason: String(data.get("reason")), ...(outcome === "ORIGINAL_AT_CUSTOMER_REQUEST" && refused ? { writtenInsistence: String(data.get("insistence")), riskRecord: String(data.get("risk")) } : {}) });
        setMessage("تم إرسال الطلب إلى قائمة الموافقات. يظل التقديم متوقفًا حتى اعتماد القرار.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حفظ الطلب. حاول مرة أخرى."); }
    }}>
      {refused && <label className="block">الإجراء المقترح بعد رفض العميل<select className="block w-full rounded border p-2" value={outcome} onChange={event => setOutcome(event.target.value as typeof outcome)}><option value="TRY_ANOTHER_PRODUCT">إبقاء الطلب مفتوحًا واقتراح تأشيرة أخرى</option><option value="FULL_REFUND_CANCEL">استرداد كامل وإلغاء الطلب</option><option value="REFUND_LESS_FEE">استرداد بعد خصم رسوم معالجة موثّقة</option><option value="ORIGINAL_AT_CUSTOMER_REQUEST">التأشيرة الأصلية بإصرار كتابي من العميل</option></select></label>}
      {financial && <><label className="block">المبلغ المنفّذ بالفعل بالدولار<input key={`${quote.id}:${outcome}`} className="block w-full rounded border p-2" name="amount" type="number" min="0.01" step="0.01" required defaultValue={((refused ? quote.oldTotalMinor : Math.abs(quote.differenceMinor)) / 100).toFixed(2)} readOnly={!refused || outcome === "FULL_REFUND_CANCEL"} /></label><label className="block">مرجع الدفع أو الاسترداد المنفّذ في Stripe<input className="block w-full rounded border p-2" name="reference" required placeholder="pi_ / ch_ for payment; re_ for refund" /></label></>}
      {refused && outcome === "ORIGINAL_AT_CUSTOMER_REQUEST" && <><label className="block">نص إصرار العميل الكتابي<textarea className="block w-full rounded border p-2" name="insistence" maxLength={1000} required /></label><label className="block">المخاطر التي تم شرحها للعميل<textarea className="block w-full rounded border p-2" name="risk" maxLength={1000} required /></label></>}
      <label className="block">سبب الطلب ودليله<textarea className="block w-full rounded border p-2" name="reason" required minLength={5} maxLength={500} /></label>
      <button className="min-h-11 rounded border px-3" disabled={request.isPending}>إرسال للموافقة</button>
    </form></>}<p aria-live="polite">{message}</p>
  </section>;
}
