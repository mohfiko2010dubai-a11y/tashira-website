import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { applications, payments } from "../../db/schema";
import { withCheckoutLock } from "./checkout-quote";
import { recordTimelineEvent, type TimelineActorType } from "./application-timeline";

export class SupersededStripeEvent extends Error {}

export function paymentTransitionAllowed(input: { paid: boolean; lastEventCreated: number; eventCreated?: number; target: "paid" | "failed" }) {
  if (input.paid && input.target === "failed") return false;
  return input.eventCreated === undefined || input.eventCreated >= input.lastEventCreated;
}

/** The state and its audit event commit together under the order's row lock. */
export async function applyStripePaymentState(input: {
  applicationId: number; paymentId: number; paymentIntentId: string; target: "paid" | "failed";
  eventCreated?: number; actorType: TimelineActorType; eventSource: string;
}) {
  return withCheckoutLock(input.applicationId, async connection => {
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
    await db.update(applications).set({ paymentStatus: input.target, stripeEventCreated: nextCreated,
      ...(input.target === "paid" && changed ? { status: "payment_received" as const } : {}) }).where(eq(applications.id, input.applicationId));
    await db.update(payments).set({ status: input.target === "paid" ? "succeeded" : "failed", stripeEventCreated: nextCreated })
      .where(eq(payments.id, input.paymentId));
    if (changed) await recordTimelineEvent({ applicationId: input.applicationId, paymentId: input.paymentId,
      eventName: input.target === "paid" ? "PAYMENT_CONFIRMED" : "PAYMENT_FAILED", eventSource: input.eventSource,
      actorType: input.actorType, actorReference: input.paymentIntentId, resultingState: input.target,
      summary: input.target === "paid" ? "Payment confirmed by Stripe" : "Stripe reported payment failure" }, db);
    return { applied: changed, paid: input.target === "paid" };
  });
}
