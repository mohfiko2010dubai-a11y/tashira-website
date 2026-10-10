import crypto from "node:crypto";
import { enforceStaffApplicationScope } from "./lib/staff-application-scope";
import { assertApplicationIntakeOpen } from "./lib/application-intake";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  applications,
  securityDepositEmailAttempts,
  securityDepositPayments,
  securityDepositRequests,
} from "@db/schema";
import { adminQuery, createRouter, securityDepositQuery, staffOrAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { publicAppOrigin } from "./lib/public-app-url";
import { createSecurityDepositIntent, retrieveStripeTestIntent } from "./lib/stripe";
import { newSecurityDepositCapability, securityDepositTokenHash, securityDepositTokenPattern } from "./lib/security-deposit-capability";
import { finalizeSecurityDepositPayment } from "./lib/security-deposit-finalization";

import { sealDepositEmail, depositDeliveryFingerprint } from "./lib/deposit-email-envelope";
import { deliverDepositEmail } from "./lib/deposit-email-delivery";

function actorReference(ctx: { staffId?: number; user?: { id: number } }) {
  if (ctx.staffId) return `staff:${ctx.staffId}`;
  return ctx.user?.id ? `user:${ctx.user.id}` : "admin-session";
}

export const securityDepositRouter = createRouter({
  // Operational projection only: never expose the customer's payment capability.
  operationalStatus: staffOrAdminQuery.input(z.object({ applicationId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await enforceStaffApplicationScope(ctx, 'securityDeposit.operationalStatus', input, false);
      return getDb().select({
      id: securityDepositRequests.id, amount: securityDepositRequests.amount,
      currency: securityDepositRequests.currency, status: securityDepositRequests.status,
      purpose: securityDepositRequests.purpose, expiresAt: securityDepositRequests.expiresAt,
      sentAt: securityDepositRequests.sentAt, paidAt: securityDepositRequests.paidAt,
    }).from(securityDepositRequests).where(eq(securityDepositRequests.applicationId, input.applicationId))
      .orderBy(desc(securityDepositRequests.createdAt));
    }),

  listByApplication: adminQuery.input(z.object({ applicationId: z.number().int().positive() }))
    .query(({ input }) => getDb().select().from(securityDepositRequests)
      .where(eq(securityDepositRequests.applicationId, input.applicationId))
      .orderBy(desc(securityDepositRequests.createdAt))),

  createAndSend: adminQuery.input(z.object({
    commandId: z.string().uuid().optional(),
    applicationId: z.number().int().positive(),
    amount: z.number().min(1).max(1_000_000),
    purpose: z.string().trim().min(5).max(255),
    expiresInDays: z.number().int().min(1).max(30).default(7),
  })).mutation(async ({ input, ctx }) => {
    if (!input.commandId) throw new TRPCError({ code: "BAD_REQUEST", message: "حدّث الصفحة لتحميل نموذج التأمين الجديد وأعد المحاولة. لم يُنشأ طلب." });
    const db = getDb(), id = input.commandId;
    const requester = actorReference(ctx);
    const creationCommandHash = crypto.createHash('sha256').update(JSON.stringify({
      applicationId: input.applicationId, amount: input.amount.toFixed(2), currency: 'AED',
      purpose: input.purpose, expiresInDays: input.expiresInDays, requester,
    })).digest('hex');
    const prepared = await db.transaction(async tx => {
      const [application] = await tx.select({ id: applications.id, referenceNumber: applications.referenceNumber,
        contactEmail: applications.contactEmail }).from(applications).where(eq(applications.id, input.applicationId)).limit(1).for('update');
      if (!application?.contactEmail) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أضف بريد العميل إلى الطلب ثم أعد المحاولة." });
      const [existing] = await tx.select({ applicationId: securityDepositRequests.applicationId,
        hash: securityDepositRequests.creationCommandHash, status: securityDepositRequests.status })
        .from(securityDepositRequests).where(eq(securityDepositRequests.id, id)).limit(1);
      if (existing) {
        if (existing.applicationId !== input.applicationId || existing.hash !== creationCommandHash)
          throw new TRPCError({ code: 'CONFLICT', message: 'تختلف البيانات عن طلب التأمين المسجل. حدّث القائمة وراجع الطلب السابق.' });
        return { created: false as const, status: existing.status };
      }
      const capability = newSecurityDepositCapability();
      const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
      await tx.insert(securityDepositRequests).values({ id, applicationId: application.id,
        amount: input.amount.toFixed(2), currency: 'AED', status: 'DRAFT', purpose: input.purpose,
        accessTokenHash: capability.hash, expiresAt, requestedBy: requester, creationCommandHash });
      const variables = {
        referenceNumber: application.referenceNumber, amount: input.amount.toFixed(2), currency: 'AED',
        purpose: input.purpose, depositUrl: `${publicAppOrigin()}/deposit/${capability.token}`, expiresAt: expiresAt.toISOString(),
      };
      await tx.insert(securityDepositEmailAttempts).values({ requestId: id, encryptedPayload: sealDepositEmail(id, {
        recipient: application.contactEmail, variables, deliveryFingerprint: depositDeliveryFingerprint(variables),
      }) });
      return { created: true as const };
    });
    if (!prepared.created) return { requestId: id, status: prepared.status, replayed: true };
    return { ...await deliverDepositEmail(id, requester), replayed: false };
  }),

  resend: adminQuery.input(z.object({
    requestId: z.string().uuid(),
    // Retained for old clients; retries must preserve the original expiry and link.
    expiresInDays: z.number().int().min(1).max(30).default(7),
  })).mutation(({ input, ctx }) => deliverDepositEmail(input.requestId, actorReference(ctx))),

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
    await assertApplicationIntakeOpen();
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
    const [payment] = await getDb().select({
      requestId: securityDepositPayments.requestId,
    }).from(securityDepositPayments).innerJoin(securityDepositRequests, and(
      eq(securityDepositRequests.id, securityDepositPayments.requestId),
      eq(securityDepositRequests.accessTokenHash, securityDepositTokenHash(input.token)),
    )).where(eq(securityDepositPayments.stripePaymentIntentId, input.paymentIntentId)).limit(1);
    if (!payment) throw new TRPCError({ code: "UNAUTHORIZED", message: "Security-deposit payment is not authorized" });
    try {
      const result = await finalizeSecurityDepositPayment(input.paymentIntentId, payment.requestId, "PAYMENT_CONFIRM_API");
      return { status: result.status };
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Security-deposit payment verification failed" });
    }
  }),
});
