import { useState } from "react";
import { trpc } from "@/providers/trpc-client";

export function ManualVisaChange({ referenceNumber }: { referenceNumber: string }) {
  const query = trpc.application.visaChangeQuote.useQuery({ referenceNumber });
  const request = trpc.application.requestManualChange.useMutation();
  const link = trpc.application.recordDifferenceLink.useMutation();
  const [outcome, setOutcome] = useState<"FULL_REFUND_CANCEL" | "REFUND_LESS_FEE" | "TRY_ANOTHER_PRODUCT" | "ORIGINAL_AT_CUSTOMER_REQUEST">("TRY_ANOTHER_PRODUCT");
  const [message, setMessage] = useState("");
  const quote = query.data;
  if (query.error) return <p role="alert">Cannot load amendment evidence. Refresh before recording settlement.</p>;
  if (!quote || !["REFUSED", "ACCEPTED", "PAYMENT_PENDING", "REFUND_PENDING"].includes(quote.state)) return null;
  const refused = quote.state === "REFUSED";
  const financial = !refused || ["FULL_REFUND_CANCEL", "REFUND_LESS_FEE"].includes(outcome);
  return <section className="mt-4 space-y-3 border-t pt-4">
    <h3 className="font-bold">Amendment settlement and refusal review</h3>
    <p>Quote version {quote.version} · {quote.state} · Difference {(quote.differenceMinor / 100).toFixed(2)} {quote.currency}</p>
    <p>Record completed Stripe movements here. Approval records settlement; it does not charge or refund the customer.</p>
    {!refused && quote.differenceMinor > 0 && <form className="flex flex-wrap gap-2" onSubmit={async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      try { await link.mutateAsync({ referenceNumber, quoteId: quote.id, version: quote.version, url: String(data.get("url")) }); await query.refetch(); setMessage("Payment link recorded for the customer."); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Link not recorded. Retry."); }
    }}><label className="grow">Stripe payment link<input className="block w-full rounded border p-2" name="url" type="url" required defaultValue={quote.paymentLink || ""} /></label><button className="min-h-11 rounded border px-3" disabled={link.isPending}>Record payment link</button></form>}
    <form className="space-y-3" onSubmit={async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      try {
        await request.mutateAsync({ referenceNumber, quoteId: quote.id, version: quote.version, kind: refused ? "REFUSAL_OUTCOME" : "SETTLEMENT",
          ...(refused ? { outcome } : {}), ...(financial ? { amountMinor: Math.round(Number(data.get("amount")) * 100), currency: "USD" as const,
            direction: !refused && quote.differenceMinor > 0 ? "TOP_UP" as const : "REFUND" as const, stripeReference: String(data.get("reference")) } : {}),
          reason: String(data.get("reason")), ...(outcome === "ORIGINAL_AT_CUSTOMER_REQUEST" && refused ? { writtenInsistence: String(data.get("insistence")), riskRecord: String(data.get("risk")) } : {}) });
        setMessage("Queued for named administrator approval. Filing remains blocked until the decision is approved.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Request not recorded. Retry."); }
    }}>
      {refused && <label className="block">Requested outcome<select className="block w-full rounded border p-2" value={outcome} onChange={event => setOutcome(event.target.value as typeof outcome)}><option value="TRY_ANOTHER_PRODUCT">Keep open and propose another product</option><option value="FULL_REFUND_CANCEL">Full refund and cancel</option><option value="REFUND_LESS_FEE">Refund less documented processing fee</option><option value="ORIGINAL_AT_CUSTOMER_REQUEST">Original product at customer's written insistence</option></select></label>}
      {financial && <><label className="block">Completed amount (USD)<input key={`${quote.id}:${outcome}`} className="block w-full rounded border p-2" name="amount" type="number" min="0.01" step="0.01" required defaultValue={((refused ? quote.oldTotalMinor : Math.abs(quote.differenceMinor)) / 100).toFixed(2)} readOnly={!refused || outcome === "FULL_REFUND_CANCEL"} /></label><label className="block">Completed Stripe payment or refund reference<input className="block w-full rounded border p-2" name="reference" required placeholder="pi_ / ch_ for payment; re_ for refund" /></label></>}
      {refused && outcome === "ORIGINAL_AT_CUSTOMER_REQUEST" && <><label className="block">Customer's written insistence<textarea className="block w-full rounded border p-2" name="insistence" maxLength={1000} required /></label><label className="block">Specific risk explained to customer<textarea className="block w-full rounded border p-2" name="risk" maxLength={1000} required /></label></>}
      <label className="block">Reason and evidence<textarea className="block w-full rounded border p-2" name="reason" required minLength={5} maxLength={500} /></label>
      <button className="min-h-11 rounded border px-3" disabled={request.isPending}>Request approval</button>
    </form><p aria-live="polite">{message}</p>
  </section>;
}
