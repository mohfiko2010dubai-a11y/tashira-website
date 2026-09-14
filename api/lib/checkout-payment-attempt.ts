import { randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { TRPCError } from "@trpc/server";

export type CheckoutPaymentAttempt = { key: string; quoteId: string; firstRequestedAt: Date; intentId: string | null };
export async function checkoutPaymentAttempt(connection: PoolConnection, applicationId: number): Promise<CheckoutPaymentAttempt | null> {
  const [rows] = await connection.execute<RowDataPacket[]>("SELECT idempotency_key,quote_id,first_requested_at,stripe_payment_intent_id FROM checkout_payment_attempts WHERE application_id=?", [applicationId]);
  return rows[0] ? { key: String(rows[0].idempotency_key), quoteId: String(rows[0].quote_id),
    firstRequestedAt: new Date(rows[0].first_requested_at), intentId: rows[0].stripe_payment_intent_id ? String(rows[0].stripe_payment_intent_id) : null } : null;
}

/** Commit this reservation before contacting Stripe, including on the first call. */
export async function reserveCheckoutPayment(connection: PoolConnection, applicationId: number, quoteId: string, existingIntentId: string | null) {
  const existing = await checkoutPaymentAttempt(connection, applicationId);
  if (existing) return existing;
  const attempt: CheckoutPaymentAttempt = { key: randomUUID(), quoteId, firstRequestedAt: new Date(), intentId: existingIntentId };
  await connection.execute("INSERT INTO checkout_payment_attempts (application_id,idempotency_key,quote_id,stripe_payment_intent_id) VALUES (?,?,?,?)",
    [applicationId, attempt.key, quoteId, existingIntentId]);
  return attempt;
}

export function assertSafeIntentRetry(attempt: CheckoutPaymentAttempt, now = new Date()) {
  // Stripe may prune idempotency keys after 24h. Keep a conservative margin and
  // never issue a new request when a prior result is unknown beyond that window.
  if (!attempt.intentId && now.getTime() - attempt.firstRequestedAt.getTime() >= 23 * 60 * 60 * 1000) {
    throw new TRPCError({ code: "CONFLICT", message: "Your previous payment setup needs verification. Contact support before trying again so we can avoid a duplicate charge." });
  }
}
