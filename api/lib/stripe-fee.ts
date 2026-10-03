import { stripeSecretKey } from "./stripe-runtime";
import { defaultOperationsPool } from "./operations/mysql-query-client";

export function parseStripeFee(value: unknown, paymentIntentId: string) {
  if (!value || typeof value !== "object" || !("id" in value) || value.id !== paymentIntentId || !("latest_charge" in value)) throw new Error("Stripe fee intent mismatch");
  const charge = value.latest_charge;
  if (!charge || typeof charge !== "object" || !("balance_transaction" in charge)) return null;
  const transaction = charge.balance_transaction;
  if (!transaction || typeof transaction !== "object") return null;
  if (!("id" in transaction) || typeof transaction.id !== "string" || !transaction.id.startsWith("txn_")
    || !("fee" in transaction) || typeof transaction.fee !== "number" || !Number.isSafeInteger(transaction.fee) || transaction.fee < 0
    || !("currency" in transaction) || typeof transaction.currency !== "string" || !/^[a-z]{3}$/.test(transaction.currency)) throw new Error("Invalid Stripe fee evidence");
  return { transactionId: transaction.id, feeMinor: transaction.fee, currency: transaction.currency.toUpperCase() };
}

/** Provider's settlement currency, never estimated from USD or the invoice FX rate. */
export async function captureStripeFee(applicationId: number, paymentId: number, paymentIntentId: string) {
  if (!/^pi_[a-zA-Z0-9_]+$/.test(paymentIntentId)) throw new Error("Invalid PaymentIntent identifier");
  const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge.balance_transaction`, {
    headers: { Authorization: `Bearer ${stripeSecretKey()}` }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Stripe fee lookup failed (${response.status})`);
  const fee = parseStripeFee(await response.json(), paymentIntentId);
  if (!fee) throw new Error("Stripe balance transaction is not available yet; retry fee reconciliation");
  await defaultOperationsPool().execute(`UPDATE payments SET stripe_fee_minor=?,stripe_fee_currency=?,stripe_balance_transaction_id=?
    WHERE id=? AND application_id=? AND stripe_payment_intent_id=? AND status='succeeded'`,
  [fee.feeMinor, fee.currency, fee.transactionId, paymentId, applicationId, paymentIntentId]);
  return fee;
}
