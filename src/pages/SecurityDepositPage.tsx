import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";
import { CheckCircle, Loader2, Shield } from "lucide-react";
import { trpc } from "@/providers/trpc-client";
import { validatedStripePublishableKey } from "@/lib/stripe-client-config";

const publishableKey = validatedStripePublishableKey(import.meta.env.STRIPE_MODE, import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function DepositCardForm({ token, clientSecret, onPaid }: { token: string; clientSecret: string; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const confirm = trpc.securityDeposit.confirmPayment.useMutation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");
    try {
      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Card form is unavailable");
      const result = await stripe.confirmCardPayment(clientSecret, { payment_method: { card } });
      if (result.error || result.paymentIntent?.status !== "succeeded") throw new Error(result.error?.message || "Payment was not completed");
      await confirm.mutateAsync({ token, paymentIntentId: result.paymentIntent.id });
      onPaid();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Payment was not completed. Please try again.");
    } finally {
      setLoading(false);
    }
  }}>
    <div className="rounded-lg border border-gray-200 p-4"><CardElement options={{ hidePostalCode: true }} /></div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <button className="w-full rounded-lg bg-[#C9A04C] px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={!stripe || loading}>
      {loading ? <Loader2 className="mx-auto animate-spin" size={20} /> : "Pay Refundable Deposit"}
    </button>
  </form>;
}

export default function SecurityDepositPage() {
  const { token = "" } = useParams<{ token: string }>();
  const request = trpc.securityDeposit.getByToken.useQuery({ token }, { enabled: token.length === 43, retry: false });
  const respond = trpc.securityDeposit.respond.useMutation({ onSuccess: () => request.refetch() });
  const createPayment = trpc.securityDeposit.createPayment.useMutation();
  const [clientSecret, setClientSecret] = useState("");
  const [paid, setPaid] = useState(false);
  const accepted = request.data?.status === "ACCEPTED" || request.data?.status === "PAYMENT_PENDING";
  const amountLabel = useMemo(() => request.data ? `${request.data.currency} ${request.data.amount.toFixed(2)}` : "", [request.data]);

  useEffect(() => {
    if (!accepted || clientSecret || createPayment.isPending) return;
    createPayment.mutate({ token }, { onSuccess: (result) => setClientSecret(result.clientSecret) });
  }, [accepted, clientSecret, createPayment, token]);

  if (request.isLoading) return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (request.error || !request.data) return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="text-2xl font-bold">Security-deposit link unavailable</h1><p className="mt-3 text-gray-500">This secure link is invalid, expired, or no longer active.</p></div>;
  if (paid || request.data.status === "PAID") return <div className="mx-auto max-w-xl px-4 py-20 text-center"><CheckCircle className="mx-auto text-emerald-600" size={52} /><h1 className="mt-4 text-2xl font-bold">Security Deposit Paid</h1><p className="mt-3 text-gray-500">The refundable deposit was verified and recorded separately from the visa service payment.</p></div>;
  if (request.data.status === "DECLINED") return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="text-2xl font-bold">Security Deposit Declined</h1><p className="mt-3 text-gray-500">Your response has been recorded. TASHIRA will review the application.</p></div>;

  return <div className="mx-auto max-w-xl px-4 py-12">
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <Shield className="text-[#C9A04C]" size={36} />
      <h1 className="mt-4 text-2xl font-bold">Refundable Security Deposit</h1>
      <p className="mt-2 text-gray-600">Amount: <strong>{amountLabel}</strong></p>
      <p className="mt-2 text-sm text-gray-500">{request.data.purpose}</p>
      <p className="mt-3 text-xs text-gray-500">This deposit is separate from visa service fees. TASHIRA does not store card numbers, CVC, or expiry details.</p>
      {request.data.status === "SENT" && <div className="mt-6 flex gap-3">
        <button className="flex-1 rounded-lg bg-[#C9A04C] px-4 py-3 font-semibold text-white" onClick={() => respond.mutate({ token, decision: "ACCEPT" })}>Accept and Continue</button>
        <button className="rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700" onClick={() => respond.mutate({ token, decision: "DECLINE" })}>Decline</button>
      </div>}
      {accepted && <div className="mt-6">{stripePromise && clientSecret
        ? <Elements stripe={stripePromise}><DepositCardForm token={token} clientSecret={clientSecret} onPaid={() => setPaid(true)} /></Elements>
        : <div className="flex items-center justify-center gap-2 py-6 text-gray-500"><Loader2 className="animate-spin" size={18} /> Preparing secure payment…</div>}
      </div>}
    </div>
  </div>;
}
