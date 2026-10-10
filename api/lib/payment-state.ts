import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { applications, payments } from "../../db/schema";
import { withCheckoutLock } from "./checkout-quote";
import { recordTimelineEvent, type TimelineActorType } from "./application-timeline";
import { issuePaidInvoice, preparePaidInvoice, type InvoiceIssueData } from "./invoice-archive";
import { FinancialFinalizationPending, retryableFinancialConflict } from "./financial-document-series";
import { syncCaseWorkStatus } from './operations/case-work-status';

export class SupersededStripeEvent extends Error {}

export function paymentTransitionAllowed(input: { paid: boolean; lastEventCreated: number; eventCreated?: number; target: "paid" | "failed" }) {
  if (input.paid && input.target === "failed") return false;
  return input.eventCreated === undefined || input.eventCreated >= input.lastEventCreated;
}

/** The state and its audit event commit together under the order's row lock. */
export async function applyStripePaymentState(input: {
  applicationId: number; paymentId: number; paymentIntentId: string; target: "paid" | "failed";
  eventCreated?: number; actorType: TimelineActorType; eventSource: string;
  invoice?: InvoiceIssueData;
}) {
  for (let attempt = 0; ; attempt++) {
    // All rendering and candidate-number reads precede BEGIN and both row locks.
    const prepared = input.target === "paid" && input.invoice
      ? await preparePaidInvoice(input.applicationId, input.paymentId, input.invoice) : undefined;
    try {
      return await withCheckoutLock(input.applicationId, async connection => {
    const db = drizzle(connection);
    const [app] = await db.select().from(applications).where(eq(applications.id, input.applicationId)).limit(1);
    const [payment] = await db.select().from(payments).where(and(eq(payments.id, input.paymentId),
      eq(payments.applicationId, input.applicationId), eq(payments.stripePaymentIntentId, input.paymentIntentId))).limit(1);
    if (!payment) throw new Error("Payment does not belong to this application");
    const paid = app.paymentStatus === "paid" || payment.status === "succeeded";
    const lastEventCreated = Math.max(app.stripeEventCreated, payment.stripeEventCreated);
    if ((app.stripePaymentIntentId && app.stripePaymentIntentId !== input.paymentIntentId)
      || !paymentTransitionAllowed({ paid, lastEventCreated, eventCreated: input.eventCreated, target: input.target })) {
      return { applied: false, paid: app.paymentStatus === "paid" };
    }
    const nextCreated = Math.max(lastEventCreated, input.eventCreated ?? 0);
    const changed = app.paymentStatus !== input.target;
    if (input.target === "paid") {
      await issuePaidInvoice(connection, input.applicationId, input.paymentId, prepared);
    }
    await db.update(applications).set({ paymentStatus: input.target, stripeEventCreated: nextCreated,
      ...(input.target === "paid" && changed ? { status: "payment_received" as const } : {}) }).where(eq(applications.id, input.applicationId));
    if (input.target === 'paid' && changed) await syncCaseWorkStatus(connection, input.applicationId, app.status, 'payment_received', `payment:${input.paymentId}`);
    await db.update(payments).set({ status: input.target === "paid" ? "succeeded" : "failed", stripeEventCreated: nextCreated })
      .where(eq(payments.id, input.paymentId));
    if (changed) await recordTimelineEvent({ applicationId: input.applicationId, paymentId: input.paymentId,
      eventName: input.target === "paid" ? "PAYMENT_CONFIRMED" : "PAYMENT_FAILED", eventSource: input.eventSource,
      actorType: input.actorType, actorReference: input.paymentIntentId, resultingState: input.target,
      summary: input.target === "paid" ? "Payment confirmed by Stripe" : "Stripe reported payment failure" }, db);
    return { applied: changed, paid: input.target === "paid" };
      }, 2);
    } catch (error) {
      if (!retryableFinancialConflict(error)) throw error;
      if (attempt >= 31) throw new FinancialFinalizationPending("Payment accounting is still being finalized; retry confirmation without charging again");
      // withCheckoutLock has rolled back and released the connection before waiting.
      await new Promise(resolve => setTimeout(resolve, Math.min(500, 25 * (attempt + 1)) + Math.random() * 50));
    }
  }
}
