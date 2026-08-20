import { eq, sql } from "drizzle-orm";
import { stripeWebhookEvents } from "@db/schema";
import { getDb } from "../queries/connection";
import { canProcessStripeWebhook } from "./stripe-webhook-idempotency-decision";

export async function claimStripeWebhookEvent(input: {
  eventId: string;
  eventType: string;
  paymentIntentId: string;
}): Promise<"process" | "duplicate"> {
  const db = getDb();
  try {
    await db.insert(stripeWebhookEvents).values({
      eventId: input.eventId,
      eventType: input.eventType,
      paymentIntentId: input.paymentIntentId,
      processingStatus: "processing",
    });
    return "process";
  } catch (error: unknown) {
    const [existing] = await db.select({
      status: stripeWebhookEvents.processingStatus,
      updatedAt: stripeWebhookEvents.updatedAt,
    }).from(stripeWebhookEvents).where(eq(stripeWebhookEvents.eventId, input.eventId)).limit(1);
    if (!existing) throw error;
    if (!canProcessStripeWebhook(existing.status, existing.updatedAt)) return "duplicate";
    await db.update(stripeWebhookEvents).set({
      eventType: input.eventType,
      paymentIntentId: input.paymentIntentId,
      processingStatus: "processing",
      processedAt: null,
      attemptCount: sql`${stripeWebhookEvents.attemptCount} + 1`,
    }).where(eq(stripeWebhookEvents.eventId, input.eventId));
    return "process";
  }
}

export async function markStripeWebhookProcessed(eventId: string) {
  await getDb().update(stripeWebhookEvents).set({
    processingStatus: "processed",
    processedAt: new Date(),
  }).where(eq(stripeWebhookEvents.eventId, eventId));
}

export async function markStripeWebhookFailed(eventId: string) {
  await getDb().update(stripeWebhookEvents).set({
    processingStatus: "failed",
  }).where(eq(stripeWebhookEvents.eventId, eventId));
}
