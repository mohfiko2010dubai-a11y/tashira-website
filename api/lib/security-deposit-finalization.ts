import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  applicationTimelineEvents,
  applications,
  securityDepositPayments,
  securityDepositRequests,
} from "@db/schema";
import { getDb } from "../queries/connection";
import { retrieveStripeTestIntent, verifySecurityDepositIntent } from "./stripe";

export async function getSecurityDepositWebhookContext(requestId: string) {
  const [request] = await getDb().select({
    applicationId: securityDepositRequests.applicationId,
    referenceNumber: applications.referenceNumber,
  }).from(securityDepositRequests)
    .innerJoin(applications, eq(applications.id, securityDepositRequests.applicationId))
    .where(eq(securityDepositRequests.id, requestId)).limit(1);
  if (!request) throw new Error("Security-deposit webhook request was not found");
  return request;
}

export async function finalizeSecurityDepositPayment(
  paymentIntentId: string,
  expectedRequestId?: string,
  eventSource: "PAYMENT_CONFIRM_API" | "STRIPE_WEBHOOK" = "STRIPE_WEBHOOK",
) {
  const db = getDb();
  const [payment] = await db.select({
    id: securityDepositPayments.id,
    status: securityDepositPayments.status,
    requestId: securityDepositPayments.requestId,
    amount: securityDepositPayments.amount,
    applicationId: securityDepositRequests.applicationId,
  }).from(securityDepositPayments).innerJoin(
    securityDepositRequests,
    eq(securityDepositRequests.id, securityDepositPayments.requestId),
  ).where(and(
    eq(securityDepositPayments.stripePaymentIntentId, paymentIntentId),
    ...(expectedRequestId ? [eq(securityDepositPayments.requestId, expectedRequestId)] : []),
  )).limit(1);
  if (!payment) throw new Error("Security-deposit payment is not authorized");
  if (payment.status === "SUCCEEDED") return { status: "PAID" as const, applicationId: payment.applicationId };

  const intent = await retrieveStripeTestIntent(paymentIntentId);
  if (!verifySecurityDepositIntent({
    intent,
    paymentIntentId,
    requestId: payment.requestId,
    expectedAmountCents: Math.round(Number(payment.amount) * 100),
  })) throw new Error("Security-deposit payment verification failed");

  await db.transaction(async (tx) => {
    const updated = await tx.update(securityDepositPayments).set({ status: "SUCCEEDED" })
      .where(and(
        eq(securityDepositPayments.id, payment.id),
        eq(securityDepositPayments.status, payment.status),
      ));
    if (Number(updated[0].affectedRows) !== 1) return;
    await tx.update(securityDepositRequests).set({ status: "PAID", paidAt: new Date() })
      .where(eq(securityDepositRequests.id, payment.requestId));
    await tx.insert(applicationTimelineEvents).values({
      id: crypto.randomUUID(),
      applicationId: payment.applicationId,
      eventName: "SECURITY_DEPOSIT_PAID",
      eventSource,
      actorType: "STRIPE",
      actorReference: paymentIntentId,
      resultingState: "PAID",
      summary: "Refundable security deposit payment verified",
    });
    const amount = Number(payment.amount).toFixed(2);
    const variables = JSON.stringify({
      statusLabelEn: `We received your refundable security deposit of AED ${amount}. This deposit is separate from visa service fees.`,
      statusLabelAr: `تم استلام التأمين المسترد بقيمة ${amount} درهم إماراتي. هذا التأمين منفصل عن رسوم خدمة التأشيرة.`,
      sourceEvent: "SECURITY_DEPOSIT_PAID",
    });
    // Commit the receipt with the payment; webhook/API retries cannot enqueue it twice.
    await tx.execute(sql`INSERT INTO transactional_email_jobs
      (job_key, application_id, template, variables_json)
      VALUES (${`application-status:security-deposit-paid:${payment.id}`},
        ${payment.applicationId}, ${"STATUS_CHANGED"}, ${variables})`);
  });
  return { status: "PAID" as const, applicationId: payment.applicationId };
}

export async function recordSecurityDepositPaymentFailure(paymentIntentId: string, expectedRequestId: string) {
  const db = getDb();
  const [payment] = await db.select({
    id: securityDepositPayments.id,
    applicationId: securityDepositRequests.applicationId,
  }).from(securityDepositPayments).innerJoin(
    securityDepositRequests,
    eq(securityDepositRequests.id, securityDepositPayments.requestId),
  ).where(and(
    eq(securityDepositPayments.stripePaymentIntentId, paymentIntentId),
    eq(securityDepositPayments.requestId, expectedRequestId),
  )).limit(1);
  if (!payment) throw new Error("Security-deposit payment is not authorized");
  const updated = await db.update(securityDepositPayments).set({ status: "FAILED" })
    .where(and(eq(securityDepositPayments.id, payment.id), eq(securityDepositPayments.status, "PENDING")));
  if (Number(updated[0].affectedRows) === 1) {
    await db.insert(applicationTimelineEvents).values({
      id: crypto.randomUUID(),
      applicationId: payment.applicationId,
      eventName: "PAYMENT_FAILED",
      eventSource: "STRIPE_WEBHOOK",
      actorType: "STRIPE",
      actorReference: paymentIntentId,
      resultingState: "PAYMENT_PENDING",
      summary: "Security deposit payment attempt failed",
    });
  }
}
