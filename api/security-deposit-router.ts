import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  applicationTimelineEvents,
  applications,
  outboundEmailEvents,
  securityDepositPayments,
  securityDepositRequests,
} from "@db/schema";
import { adminQuery, createRouter, securityDepositQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { transactionalEmailProvider } from "./lib/email-provider";
import { recipientHash } from "./lib/resend-email";
import { publicAppOrigin } from "./lib/public-app-url";
import { createSecurityDepositIntent, retrieveStripeTestIntent, verifySecurityDepositIntent } from "./lib/stripe";
import { newSecurityDepositCapability, securityDepositTokenHash, securityDepositTokenPattern } from "./lib/security-deposit-capability";

function actorReference(ctx: { user?: { id: number } }) {
  return ctx.user?.id ? `user:${ctx.user.id}` : "admin-session";
}

export const securityDepositRouter = createRouter({
  listByApplication: adminQuery.input(z.object({ applicationId: z.number().int().positive() }))
    .query(({ input }) => getDb().select().from(securityDepositRequests)
      .where(eq(securityDepositRequests.applicationId, input.applicationId))
      .orderBy(desc(securityDepositRequests.createdAt))),

  createAndSend: adminQuery.input(z.object({
    applicationId: z.number().int().positive(),
    amount: z.number().min(1).max(1_000_000),
    purpose: z.string().trim().min(5).max(255),
    expiresInDays: z.number().int().min(1).max(30).default(7),
  })).mutation(async ({ input, ctx }) => {
    const db = getDb();
    const [application] = await db.select({
      id: applications.id,
      referenceNumber: applications.referenceNumber,
      contactEmail: applications.contactEmail,
    }).from(applications).where(eq(applications.id, input.applicationId)).limit(1);
    if (!application?.contactEmail) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Application email is required" });

    const id = crypto.randomUUID();
    const capability = newSecurityDepositCapability();
    const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
    await db.insert(securityDepositRequests).values({
      id,
      applicationId: application.id,
      amount: input.amount.toFixed(2),
      currency: "AED",
      status: "DRAFT",
      purpose: input.purpose,
      accessTokenHash: capability.hash,
      expiresAt,
      requestedBy: actorReference(ctx),
    });

    let providerName = "unavailable";
    try {
      const provider = transactionalEmailProvider();
      providerName = provider.name;
      const sent = await provider.send({
        recipient: application.contactEmail,
        template: "SECURITY_DEPOSIT_REQUEST",
        idempotencyKey: `security-deposit/${id}`,
        variables: {
          referenceNumber: application.referenceNumber,
          amount: input.amount.toFixed(2),
          currency: "AED",
          purpose: input.purpose,
          depositUrl: `${publicAppOrigin()}/deposit/${capability.token}`,
          expiresAt: expiresAt.toISOString(),
        },
      });
      await db.transaction(async (tx) => {
        await tx.update(securityDepositRequests).set({ status: "SENT", sentAt: new Date() })
          .where(and(eq(securityDepositRequests.id, id), eq(securityDepositRequests.status, "DRAFT")));
        await tx.insert(outboundEmailEvents).values({
          id: crypto.randomUUID(), applicationId: application.id, template: "SECURITY_DEPOSIT_REQUEST",
          recipientHash: recipientHash(application.contactEmail), provider: provider.name, status: "SENT",
          providerReference: sent.reference,
        });
        await tx.insert(applicationTimelineEvents).values({
          id: crypto.randomUUID(), applicationId: application.id, eventName: "SECURITY_DEPOSIT_REQUESTED",
          eventSource: "ADMIN_DASHBOARD", actorType: "ADMIN", actorReference: actorReference(ctx),
          resultingState: "SENT", summary: "Refundable security-deposit request sent securely",
        });
      });
      return { requestId: id, status: "SENT" as const };
    } catch {
      await db.insert(outboundEmailEvents).values({
        id: crypto.randomUUID(), applicationId: application.id, template: "SECURITY_DEPOSIT_REQUEST",
        recipientHash: recipientHash(application.contactEmail), provider: providerName, status: "FAILED",
        failureCategory: "delivery_failed",
      });
      return { requestId: id, status: "DRAFT" as const };
    }
  }),

  getByToken: securityDepositQuery.input(z.object({ token: z.string().regex(securityDepositTokenPattern) })).query(async ({ input }) => {
    const [request] = await getDb().select({
      id: securityDepositRequests.id,
      amount: securityDepositRequests.amount,
      currency: securityDepositRequests.currency,
      status: securityDepositRequests.status,
      purpose: securityDepositRequests.purpose,
      expiresAt: securityDepositRequests.expiresAt,
    }).from(securityDepositRequests).where(and(
      eq(securityDepositRequests.accessTokenHash, securityDepositTokenHash(input.token)),
      gt(securityDepositRequests.expiresAt, new Date()),
      inArray(securityDepositRequests.status, ["SENT", "ACCEPTED", "DECLINED", "PAYMENT_PENDING", "PAID"]),
    )).limit(1);
    if (!request) throw new TRPCError({ code: "UNAUTHORIZED", message: "Security-deposit link is invalid or expired" });
    return { ...request, amount: Number(request.amount) };
  }),

  respond: securityDepositQuery.input(z.object({
    token: z.string().regex(securityDepositTokenPattern),
    decision: z.enum(["ACCEPT", "DECLINE"]),
  })).mutation(async ({ input }) => {
    const nextStatus = input.decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";
    const now = new Date();
    const result = await getDb().update(securityDepositRequests).set({
      status: nextStatus,
      acceptedAt: input.decision === "ACCEPT" ? now : null,
      declinedAt: input.decision === "DECLINE" ? now : null,
    }).where(and(
      eq(securityDepositRequests.accessTokenHash, securityDepositTokenHash(input.token)),
      eq(securityDepositRequests.status, "SENT"),
      gt(securityDepositRequests.expiresAt, now),
    ));
    if (Number(result[0].affectedRows) !== 1) throw new TRPCError({ code: "CONFLICT", message: "Security-deposit request cannot be changed" });
    return { status: nextStatus };
  }),

  createPayment: securityDepositQuery.input(z.object({ token: z.string().regex(securityDepositTokenPattern) })).mutation(async ({ input }) => {
    const db = getDb();
    const [request] = await db.select({
      id: securityDepositRequests.id,
      applicationId: securityDepositRequests.applicationId,
      amount: securityDepositRequests.amount,
      status: securityDepositRequests.status,
      expiresAt: securityDepositRequests.expiresAt,
      referenceNumber: applications.referenceNumber,
    }).from(securityDepositRequests).innerJoin(applications, eq(applications.id, securityDepositRequests.applicationId))
      .where(and(eq(securityDepositRequests.accessTokenHash, securityDepositTokenHash(input.token)), gt(securityDepositRequests.expiresAt, new Date())))
      .limit(1);
    if (!request || !["ACCEPTED", "PAYMENT_PENDING"].includes(request.status)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Security-deposit request must be accepted first" });
    }
    const [existing] = await db.select().from(securityDepositPayments)
      .where(eq(securityDepositPayments.requestId, request.id)).limit(1);
    if (existing?.status === "SUCCEEDED") throw new TRPCError({ code: "CONFLICT", message: "Security deposit is already paid" });

    const intent = existing
      ? await retrieveStripeTestIntent(existing.stripePaymentIntentId)
      : await createSecurityDepositIntent({
        amountCents: Math.round(Number(request.amount) * 100),
        requestId: request.id,
        applicationReference: request.referenceNumber,
        idempotencyKey: `security-deposit-${request.id}`,
      });
    if (!intent.client_secret) throw new TRPCError({ code: "BAD_REQUEST", message: "Stripe did not return a client secret" });
    if (!existing) {
      await db.transaction(async (tx) => {
        await tx.insert(securityDepositPayments).values({
          id: crypto.randomUUID(), requestId: request.id, stripePaymentIntentId: intent.id,
          amount: request.amount, currency: "AED", status: "PENDING",
        });
        await tx.update(securityDepositRequests).set({ status: "PAYMENT_PENDING" })
          .where(and(eq(securityDepositRequests.id, request.id), eq(securityDepositRequests.status, "ACCEPTED")));
      });
    }
    return { clientSecret: intent.client_secret, amount: Number(request.amount), currency: "AED" as const };
  }),

  confirmPayment: securityDepositQuery.input(z.object({
    token: z.string().regex(securityDepositTokenPattern),
    paymentIntentId: z.string().regex(/^pi_[A-Za-z0-9_]+$/u),
  })).mutation(async ({ input }) => {
    const db = getDb();
    const [payment] = await db.select({
      id: securityDepositPayments.id,
      status: securityDepositPayments.status,
      requestId: securityDepositPayments.requestId,
      amount: securityDepositPayments.amount,
      applicationId: securityDepositRequests.applicationId,
    }).from(securityDepositPayments).innerJoin(securityDepositRequests, and(
      eq(securityDepositRequests.id, securityDepositPayments.requestId),
      eq(securityDepositRequests.accessTokenHash, securityDepositTokenHash(input.token)),
    )).where(eq(securityDepositPayments.stripePaymentIntentId, input.paymentIntentId)).limit(1);
    if (!payment) throw new TRPCError({ code: "UNAUTHORIZED", message: "Security-deposit payment is not authorized" });
    if (payment.status === "SUCCEEDED") return { status: "PAID" as const };
    const intent = await retrieveStripeTestIntent(input.paymentIntentId);
    if (!verifySecurityDepositIntent({
      intent, paymentIntentId: input.paymentIntentId, requestId: payment.requestId,
      expectedAmountCents: Math.round(Number(payment.amount) * 100),
    })) throw new TRPCError({ code: "BAD_REQUEST", message: "Security-deposit payment verification failed" });

    await db.transaction(async (tx) => {
      await tx.update(securityDepositPayments).set({ status: "SUCCEEDED" })
        .where(eq(securityDepositPayments.id, payment.id));
      await tx.update(securityDepositRequests).set({ status: "PAID", paidAt: new Date() })
        .where(eq(securityDepositRequests.id, payment.requestId));
      await tx.insert(applicationTimelineEvents).values({
        id: crypto.randomUUID(), applicationId: payment.applicationId, eventName: "SECURITY_DEPOSIT_PAID",
        eventSource: "PAYMENT_CONFIRM_API", actorType: "STRIPE", actorReference: input.paymentIntentId,
        resultingState: "PAID", summary: "Refundable security deposit payment verified",
      });
    });
    return { status: "PAID" as const };
  }),
});
