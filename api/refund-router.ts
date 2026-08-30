import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  applicationTimelineEvents,
  applications,
  financialEvents,
  payments,
  refundCases,
  refundItems,
  securityDepositPayments,
  securityDepositRequests,
} from "@db/schema";
import { adminQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { verifyAdminPasswordAsync } from "./lib/admin-session";
import { assertRefundSource, calculateRefund, deriveRefundCaseStatus, reconcileRefundStatus, type RefundDeduction } from "./lib/refund-domain";
import { createStripeRefund, retrieveStripeRefund } from "./lib/stripe";
import { sendRefundOutcomeEmail } from "./lib/refund-outcome-email";

const currency = z.string().regex(/^[A-Za-z]{3}$/u).transform((value) => value.toUpperCase());
const deduction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NONE") }),
  z.object({ type: z.literal("PERCENTAGE"), value: z.number().min(0).max(100) }),
  z.object({ type: z.literal("FIXED"), value: z.number().min(0) }),
  z.object({ type: z.literal("ACTUAL_COSTS"), value: z.number().min(0) }),
]);

const itemInput = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("VISA_SERVICE"),
    paymentId: z.number().int().positive(),
    requestedAmount: z.number().positive(),
    deduction,
  }),
  z.object({
    sourceType: z.literal("SECURITY_DEPOSIT"),
    securityDepositPaymentId: z.string().uuid(),
    requestedAmount: z.number().positive(),
    deduction,
  }),
]);

function actorReference(ctx: { user?: { id: number } }) {
  return ctx.user?.id ? `user:${ctx.user.id}` : "admin-session";
}

export const refundRouter = createRouter({
  eligibleSources: adminQuery.input(z.object({ applicationId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const visaPayments = await db.select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
      }).from(payments).where(and(
        eq(payments.applicationId, input.applicationId),
        eq(payments.status, "succeeded"),
      ));
      const depositPayments = await db.select({
        id: securityDepositPayments.id,
        amount: securityDepositPayments.amount,
        currency: securityDepositPayments.currency,
      }).from(securityDepositPayments).innerJoin(
        securityDepositRequests,
        and(
          eq(securityDepositRequests.id, securityDepositPayments.requestId),
          eq(securityDepositRequests.applicationId, input.applicationId),
        ),
      ).where(eq(securityDepositPayments.status, "SUCCEEDED"));

      const withAvailability = async (source: "VISA_SERVICE" | "SECURITY_DEPOSIT", id: number | string, amount: string, sourceCurrency: string) => {
        const sourceCondition = source === "VISA_SERVICE"
          ? eq(refundItems.paymentId, Number(id))
          : eq(refundItems.securityDepositPaymentId, String(id));
        const [reserved] = await db.select({ total: sql<string>`coalesce(sum(${refundItems.refundAmount}), 0)` })
          .from(refundItems).where(and(sourceCondition, inArray(refundItems.status, ["PENDING", "PROCESSING", "SUCCEEDED"])));
        return {
          sourceType: source,
          id,
          originalAmount: Number(amount),
          availableAmount: Math.max(0, Number(amount) - Number(reserved?.total || 0)),
          currency: sourceCurrency.toUpperCase(),
        };
      };
      return Promise.all([
        ...visaPayments.map((payment) => withAvailability("VISA_SERVICE", payment.id, payment.amount, payment.currency)),
        ...depositPayments.map((payment) => withAvailability("SECURITY_DEPOSIT", payment.id, payment.amount, payment.currency)),
      ]);
    }),

  listByApplication: adminQuery.input(z.object({ applicationId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const cases = await db.select().from(refundCases)
        .where(eq(refundCases.applicationId, input.applicationId))
        .orderBy(desc(refundCases.createdAt));
      return Promise.all(cases.map(async (refundCase) => ({
        ...refundCase,
        items: await db.select().from(refundItems)
          .where(eq(refundItems.refundCaseId, refundCase.id)).orderBy(refundItems.createdAt),
      })));
    }),

  getCase: adminQuery.input(z.object({ refundCaseId: z.string().uuid() })).query(async ({ input }) => {
    const [refundCase] = await getDb().select().from(refundCases)
      .where(eq(refundCases.id, input.refundCaseId)).limit(1);
    if (!refundCase) throw new TRPCError({ code: "NOT_FOUND", message: "Refund case not found" });
    const items = await getDb().select().from(refundItems)
      .where(eq(refundItems.refundCaseId, refundCase.id)).orderBy(refundItems.createdAt);
    return { refundCase, items };
  }),

  createCase: adminQuery.input(z.object({
    applicationId: z.number().int().positive(),
    reason: z.string().trim().min(5).max(500),
    policyVersion: z.string().trim().min(1).max(50),
    items: z.array(itemInput).min(1).max(2),
  })).mutation(async ({ input, ctx }) => getDb().transaction(async (tx) => {
    const [application] = await tx.select({ id: applications.id }).from(applications)
      .where(eq(applications.id, input.applicationId)).limit(1);
    if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });

    const refundCaseId = crypto.randomUUID();
    const preparedItems: Array<typeof refundItems.$inferInsert> = [];
    const depositRequestIds: string[] = [];
    for (const item of input.items) {
      if (item.sourceType === "VISA_SERVICE") {
        assertRefundSource({ sourceType: item.sourceType, paymentId: item.paymentId });
        const [payment] = await tx.select().from(payments).where(and(
          eq(payments.id, item.paymentId),
          eq(payments.applicationId, input.applicationId),
          eq(payments.status, "succeeded"),
        )).limit(1);
        if (!payment) throw new TRPCError({ code: "BAD_REQUEST", message: "A succeeded application payment is required" });
        const [reserved] = await tx.select({ total: sql<string>`coalesce(sum(${refundItems.refundAmount}), 0)` })
          .from(refundItems).where(and(
            eq(refundItems.paymentId, payment.id),
            inArray(refundItems.status, ["PENDING", "PROCESSING", "SUCCEEDED"]),
          ));
        const available = Number(payment.amount) - Number(reserved?.total || 0);
        const calculation = calculateRefund({
          paidAmount: available,
          requestedAmount: item.requestedAmount,
          deduction: item.deduction as RefundDeduction,
        });
        preparedItems.push({
          id: crypto.randomUUID(), refundCaseId, sourceType: item.sourceType, paymentId: payment.id,
          originalAmount: payment.amount, requestedAmount: calculation.requestedAmount.toFixed(2),
          deductionType: item.deduction.type, deductionValue: ("value" in item.deduction ? item.deduction.value : 0).toFixed(4),
          refundAmount: calculation.refundAmount.toFixed(2), currency: payment.currency.toUpperCase(),
          idempotencyKey: `refund-${crypto.randomUUID()}`,
        });
      } else {
        assertRefundSource({ sourceType: item.sourceType, securityDepositPaymentId: item.securityDepositPaymentId });
        const [deposit] = await tx.select({
          id: securityDepositPayments.id,
          requestId: securityDepositPayments.requestId,
          amount: securityDepositPayments.amount,
          currency: securityDepositPayments.currency,
        }).from(securityDepositPayments).innerJoin(
          securityDepositRequests,
          and(
            eq(securityDepositRequests.id, securityDepositPayments.requestId),
            eq(securityDepositRequests.applicationId, input.applicationId),
          ),
        ).where(and(
          eq(securityDepositPayments.id, item.securityDepositPaymentId),
          eq(securityDepositPayments.status, "SUCCEEDED"),
        )).limit(1);
        if (!deposit) throw new TRPCError({ code: "BAD_REQUEST", message: "A succeeded security-deposit payment is required" });
        const [reserved] = await tx.select({ total: sql<string>`coalesce(sum(${refundItems.refundAmount}), 0)` })
          .from(refundItems).where(and(
            eq(refundItems.securityDepositPaymentId, deposit.id),
            inArray(refundItems.status, ["PENDING", "PROCESSING", "SUCCEEDED"]),
          ));
        const available = Number(deposit.amount) - Number(reserved?.total || 0);
        const calculation = calculateRefund({
          paidAmount: available,
          requestedAmount: item.requestedAmount,
          deduction: item.deduction as RefundDeduction,
        });
        preparedItems.push({
          id: crypto.randomUUID(), refundCaseId, sourceType: item.sourceType, securityDepositPaymentId: deposit.id,
          originalAmount: deposit.amount, requestedAmount: calculation.requestedAmount.toFixed(2),
          deductionType: item.deduction.type, deductionValue: ("value" in item.deduction ? item.deduction.value : 0).toFixed(4),
          refundAmount: calculation.refundAmount.toFixed(2), currency: currency.parse(deposit.currency),
          idempotencyKey: `refund-${crypto.randomUUID()}`,
        });
        depositRequestIds.push(deposit.requestId);
      }
    }

    const sources = preparedItems.map((item) => item.sourceType);
    if (new Set(sources).size !== sources.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A refund case may contain only one item for each payment source" });
    }
    await tx.insert(refundCases).values({
      id: refundCaseId,
      applicationId: input.applicationId,
      status: "PENDING_APPROVAL",
      reason: input.reason,
      policyVersion: input.policyVersion,
      requestedBy: actorReference(ctx),
    });
    await tx.insert(refundItems).values(preparedItems);
    if (depositRequestIds.length > 0) {
      await tx.update(securityDepositRequests).set({ status: "REFUND_PENDING" })
        .where(inArray(securityDepositRequests.id, depositRequestIds));
    }
    await tx.insert(financialEvents).values(preparedItems.map((item) => ({
      id: crypto.randomUUID(),
      applicationId: input.applicationId,
      paymentId: item.paymentId,
      eventType: "REFUND_REQUESTED" as const,
      amount: item.refundAmount,
      currency: item.currency,
      sourceReference: refundCaseId,
      actorReference: actorReference(ctx),
    })));
    await tx.insert(applicationTimelineEvents).values({
      id: crypto.randomUUID(),
      applicationId: input.applicationId,
      eventName: "REFUND_REQUESTED",
      eventSource: "ADMIN_DASHBOARD",
      actorType: "ADMIN",
      actorReference: actorReference(ctx),
      resultingState: "PENDING_APPROVAL",
      summary: "Refund case created for administrative review",
    });
    return { refundCaseId, status: "PENDING_APPROVAL" as const };
  })),

  approveCase: adminQuery.input(z.object({
    refundCaseId: z.string().uuid(),
    adminPassword: z.string().min(1).max(500),
  })).mutation(async ({ input, ctx }) => {
    if (!(await verifyAdminPasswordAsync(input.adminPassword))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator re-authentication failed" });
    }
    await getDb().transaction(async (tx) => {
      const [refundCase] = await tx.select({ applicationId: refundCases.applicationId }).from(refundCases)
        .where(and(eq(refundCases.id, input.refundCaseId), eq(refundCases.status, "PENDING_APPROVAL"))).limit(1);
      if (!refundCase) throw new TRPCError({ code: "CONFLICT", message: "Refund case is not awaiting approval" });
      const result = await tx.update(refundCases).set({
        status: "APPROVED",
        approvedBy: actorReference(ctx),
        approvedAt: new Date(),
      }).where(and(eq(refundCases.id, input.refundCaseId), eq(refundCases.status, "PENDING_APPROVAL")));
      if (Number(result[0].affectedRows) !== 1) {
        throw new TRPCError({ code: "CONFLICT", message: "Refund case is not awaiting approval" });
      }
      await tx.insert(applicationTimelineEvents).values({
        id: crypto.randomUUID(),
        applicationId: refundCase.applicationId,
        eventName: "REFUND_APPROVED",
        eventSource: "ADMIN_DASHBOARD",
        actorType: "ADMIN",
        actorReference: actorReference(ctx),
        resultingState: "APPROVED",
        summary: "Refund case approved after administrator re-authentication",
      });
    });
    return { status: "APPROVED" as const };
  }),

  executeCase: adminQuery.input(z.object({
    refundCaseId: z.string().uuid(),
    adminPassword: z.string().min(1).max(500),
    confirmation: z.literal("EXECUTE REFUND"),
  })).mutation(async ({ input, ctx }) => {
    if (!(await verifyAdminPasswordAsync(input.adminPassword))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator re-authentication failed" });
    }

    const db = getDb();
    const claimed = await db.transaction(async (tx) => {
      const [refundCase] = await tx.select().from(refundCases)
        .where(eq(refundCases.id, input.refundCaseId)).limit(1);
      if (!refundCase || refundCase.status !== "APPROVED") {
        throw new TRPCError({ code: "CONFLICT", message: "Refund case is not approved for execution" });
      }
      const items = await tx.select({
        id: refundItems.id,
        sourceType: refundItems.sourceType,
        paymentId: refundItems.paymentId,
        securityDepositPaymentId: refundItems.securityDepositPaymentId,
        refundAmount: refundItems.refundAmount,
        currency: refundItems.currency,
        idempotencyKey: refundItems.idempotencyKey,
        paymentIntentId: sql<string>`coalesce(${payments.stripePaymentIntentId}, ${securityDepositPayments.stripePaymentIntentId})`,
      }).from(refundItems)
        .leftJoin(payments, eq(payments.id, refundItems.paymentId))
        .leftJoin(securityDepositPayments, eq(securityDepositPayments.id, refundItems.securityDepositPaymentId))
        .where(and(eq(refundItems.refundCaseId, refundCase.id), eq(refundItems.status, "PENDING")));
      if (items.length === 0) throw new TRPCError({ code: "CONFLICT", message: "Refund case has no pending items" });
      if (items.some((item) => !item.paymentIntentId || item.currency.length !== 3)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Refund payment source is incomplete" });
      }
      const caseUpdate = await tx.update(refundCases).set({ status: "PROCESSING" })
        .where(and(eq(refundCases.id, refundCase.id), eq(refundCases.status, "APPROVED")));
      if (Number(caseUpdate[0].affectedRows) !== 1) {
        throw new TRPCError({ code: "CONFLICT", message: "Refund case was already claimed" });
      }
      await tx.update(refundItems).set({ status: "PROCESSING" })
        .where(and(eq(refundItems.refundCaseId, refundCase.id), eq(refundItems.status, "PENDING")));
      return { refundCase, items };
    });

    let succeeded = 0;
    let processing = 0;
    for (const item of claimed.items) {
      try {
        const stripeRefund = await createStripeRefund({
          paymentIntentId: item.paymentIntentId,
          amountCents: Math.round(Number(item.refundAmount) * 100),
          idempotencyKey: item.idempotencyKey,
          metadata: { refundCaseId: claimed.refundCase.id, refundItemId: item.id, sourceType: item.sourceType },
        });
        const itemStatus = stripeRefund.status === "succeeded" ? "SUCCEEDED" : "PROCESSING";
        await db.update(refundItems).set({ status: itemStatus, stripeRefundId: stripeRefund.id, failureCategory: null })
          .where(and(eq(refundItems.id, item.id), eq(refundItems.status, "PROCESSING")));
        if (itemStatus === "SUCCEEDED") succeeded += 1;
        else processing += 1;
      } catch (error: unknown) {
        const category = error instanceof Error ? error.message.replace(/^Stripe refund failed: /u, "").slice(0, 80) : "unknown";
        await db.update(refundItems).set({ status: "FAILED", failureCategory: category })
          .where(and(eq(refundItems.id, item.id), eq(refundItems.status, "PROCESSING")));
      }
    }

    const finalStatus = succeeded === claimed.items.length
      ? "REFUNDED"
      : processing > 0
        ? "PROCESSING"
        : succeeded > 0
          ? "PARTIALLY_REFUNDED"
          : "FAILED";
    await db.transaction(async (tx) => {
      await tx.update(refundCases).set({
        status: finalStatus,
        completedAt: finalStatus === "REFUNDED" ? new Date() : null,
      }).where(and(eq(refundCases.id, claimed.refundCase.id), eq(refundCases.status, "PROCESSING")));
      if (finalStatus !== "PROCESSING") {
        await tx.insert(applicationTimelineEvents).values({
          id: crypto.randomUUID(),
          applicationId: claimed.refundCase.applicationId,
          eventName: finalStatus === "REFUNDED" ? "REFUND_COMPLETED" : "REFUND_FAILED",
          eventSource: "ADMIN_DASHBOARD",
          actorType: "ADMIN",
          actorReference: actorReference(ctx),
          resultingState: finalStatus,
          summary: finalStatus === "REFUNDED" ? "Approved refund completed through Stripe" : "Approved refund requires administrative review",
        });
      }
      if (succeeded > 0) {
        const succeededItems = await tx.select().from(refundItems).where(and(
          eq(refundItems.refundCaseId, claimed.refundCase.id),
          eq(refundItems.status, "SUCCEEDED"),
        ));
        await tx.insert(financialEvents).values(succeededItems.map((item) => ({
          id: crypto.randomUUID(),
          applicationId: claimed.refundCase.applicationId,
          paymentId: item.paymentId,
          eventType: "REFUND_COMPLETED" as const,
          amount: item.refundAmount,
          currency: item.currency,
          sourceReference: item.stripeRefundId || claimed.refundCase.id,
          actorReference: actorReference(ctx),
        })));
      }
      for (const item of claimed.items.filter((entry) => entry.sourceType === "SECURITY_DEPOSIT" && entry.securityDepositPaymentId)) {
        const [depositPayment] = await tx.select({
          requestId: securityDepositPayments.requestId,
          amount: securityDepositPayments.amount,
        }).from(securityDepositPayments).where(eq(securityDepositPayments.id, item.securityDepositPaymentId!)).limit(1);
        if (!depositPayment) continue;
        const [refunded] = await tx.select({ total: sql<string>`coalesce(sum(${refundItems.refundAmount}), 0)` })
          .from(refundItems).where(and(
            eq(refundItems.securityDepositPaymentId, item.securityDepositPaymentId!),
            eq(refundItems.status, "SUCCEEDED"),
          ));
        const refundedAmount = Number(refunded?.total || 0);
        const depositStatus = refundedAmount >= Number(depositPayment.amount)
          ? "REFUNDED"
          : refundedAmount > 0
            ? "PARTIALLY_REFUNDED"
            : finalStatus === "PROCESSING" ? "REFUND_PENDING" : "PAID";
        await tx.update(securityDepositRequests).set({ status: depositStatus })
          .where(eq(securityDepositRequests.id, depositPayment.requestId));
      }
    });
    const email = await sendRefundOutcomeEmail(claimed.refundCase.id).catch(() => ({ status: "FAILED" as const }));
    return { status: finalStatus, succeededItems: succeeded, totalItems: claimed.items.length, emailStatus: email.status };
  }),

  reconcileCase: adminQuery.input(z.object({
    refundCaseId: z.string().uuid(),
    adminPassword: z.string().min(1).max(500),
    confirmation: z.literal("RECONCILE REFUND"),
  })).mutation(async ({ input, ctx }) => {
    if (!(await verifyAdminPasswordAsync(input.adminPassword))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator re-authentication failed" });
    }

    const db = getDb();
    const [refundCase] = await db.select().from(refundCases)
      .where(eq(refundCases.id, input.refundCaseId)).limit(1);
    if (!refundCase || refundCase.status !== "PROCESSING") {
      throw new TRPCError({ code: "CONFLICT", message: "Refund case is not awaiting Stripe reconciliation" });
    }
    const pendingItems = await db.select({
      id: refundItems.id,
      sourceType: refundItems.sourceType,
      paymentId: refundItems.paymentId,
      securityDepositPaymentId: refundItems.securityDepositPaymentId,
      refundAmount: refundItems.refundAmount,
      currency: refundItems.currency,
      stripeRefundId: refundItems.stripeRefundId,
      paymentIntentId: sql<string>`coalesce(${payments.stripePaymentIntentId}, ${securityDepositPayments.stripePaymentIntentId})`,
    }).from(refundItems)
      .leftJoin(payments, eq(payments.id, refundItems.paymentId))
      .leftJoin(securityDepositPayments, eq(securityDepositPayments.id, refundItems.securityDepositPaymentId))
      .where(and(eq(refundItems.refundCaseId, refundCase.id), eq(refundItems.status, "PROCESSING")));
    if (pendingItems.length === 0) {
      throw new TRPCError({ code: "CONFLICT", message: "Refund case has no processing items" });
    }
    if (pendingItems.some((item) => !item.stripeRefundId || !item.paymentIntentId)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe refund reference is incomplete" });
    }

    const newlySucceeded: typeof pendingItems = [];
    for (const item of pendingItems) {
      try {
        const stripeRefund = await retrieveStripeRefund(item.stripeRefundId!, item.paymentIntentId);
        const status = reconcileRefundStatus(stripeRefund.status);
        const update = await db.update(refundItems).set({
          status,
          failureCategory: status === "FAILED" ? "stripe_refund_failed" : null,
        }).where(and(eq(refundItems.id, item.id), eq(refundItems.status, "PROCESSING")));
        if (status === "SUCCEEDED" && Number(update[0].affectedRows) === 1) newlySucceeded.push(item);
      } catch (error: unknown) {
        const category = error instanceof Error ? error.message.replace(/^Stripe refund retrieval failed: /u, "").slice(0, 80) : "unknown";
        await db.update(refundItems).set({ failureCategory: category })
          .where(and(eq(refundItems.id, item.id), eq(refundItems.status, "PROCESSING")));
      }
    }

    const allItems = await db.select({ status: refundItems.status }).from(refundItems)
      .where(eq(refundItems.refundCaseId, refundCase.id));
    const finalStatus = deriveRefundCaseStatus(allItems.map((item) => {
      if (item.status === "SUCCEEDED" || item.status === "PROCESSING" || item.status === "FAILED") return item.status;
      return "FAILED";
    }));

    await db.transaction(async (tx) => {
      if (finalStatus !== "PROCESSING") {
        const update = await tx.update(refundCases).set({
          status: finalStatus,
          completedAt: finalStatus === "REFUNDED" ? new Date() : null,
        }).where(and(eq(refundCases.id, refundCase.id), eq(refundCases.status, "PROCESSING")));
        if (Number(update[0].affectedRows) === 1) {
          await tx.insert(applicationTimelineEvents).values({
            id: crypto.randomUUID(),
            applicationId: refundCase.applicationId,
            eventName: finalStatus === "REFUNDED" ? "REFUND_COMPLETED" : "REFUND_FAILED",
            eventSource: "ADMIN_DASHBOARD",
            actorType: "ADMIN",
            actorReference: actorReference(ctx),
            resultingState: finalStatus,
            summary: finalStatus === "REFUNDED" ? "Stripe refund status reconciled successfully" : "Stripe refund reconciliation requires administrative review",
          });
        }
      }
      for (const item of newlySucceeded) {
        const [existing] = await tx.select({ id: financialEvents.id }).from(financialEvents)
          .where(eq(financialEvents.sourceReference, item.stripeRefundId!)).limit(1);
        if (!existing) {
          await tx.insert(financialEvents).values({
            id: crypto.randomUUID(),
            applicationId: refundCase.applicationId,
            paymentId: item.paymentId,
            eventType: "REFUND_COMPLETED",
            amount: item.refundAmount,
            currency: item.currency,
            sourceReference: item.stripeRefundId,
            actorReference: actorReference(ctx),
          });
        }
      }
      for (const item of pendingItems.filter((entry) => entry.sourceType === "SECURITY_DEPOSIT" && entry.securityDepositPaymentId)) {
        const [depositPayment] = await tx.select({ requestId: securityDepositPayments.requestId, amount: securityDepositPayments.amount })
          .from(securityDepositPayments).where(eq(securityDepositPayments.id, item.securityDepositPaymentId!)).limit(1);
        if (!depositPayment) continue;
        const [refunded] = await tx.select({ total: sql<string>`coalesce(sum(${refundItems.refundAmount}), 0)` })
          .from(refundItems).where(and(eq(refundItems.securityDepositPaymentId, item.securityDepositPaymentId!), eq(refundItems.status, "SUCCEEDED")));
        const refundedAmount = Number(refunded?.total || 0);
        const depositStatus = refundedAmount >= Number(depositPayment.amount)
          ? "REFUNDED"
          : refundedAmount > 0
            ? "PARTIALLY_REFUNDED"
            : finalStatus === "PROCESSING" ? "REFUND_PENDING" : "PAID";
        await tx.update(securityDepositRequests).set({ status: depositStatus })
          .where(eq(securityDepositRequests.id, depositPayment.requestId));
      }
    });
    const email = await sendRefundOutcomeEmail(refundCase.id).catch(() => ({ status: "FAILED" as const }));
    return { status: finalStatus, reconciledItems: pendingItems.length, newlySucceededItems: newlySucceeded.length, emailStatus: email.status };
  }),
});
