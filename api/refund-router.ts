import crypto from "node:crypto";
import { createExpressGuaranteeRefund, processingGuarantees } from "./lib/express-guarantee-refund";
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
import { adminQuery, createRouter, staffOrAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { verifyNamedStaffPassword } from "./lib/named-staff-password";
import { executeApprovedRefund } from "./lib/execute-refund";
import { assertRefundSource, calculateRefund, deriveRefundCaseStatus, reconcileRefundStatus, type RefundDeduction } from "./lib/refund-domain";
import { findStripeRefund, retrieveStripeRefund } from "./lib/stripe";
import { sendRefundOutcomeEmail } from "./lib/refund-outcome-email";
import { completeVisaRefundWithCreditNote } from "./lib/refund-credit-note";

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
  processingGuarantees: adminQuery.input(z.object({ applicationId: z.number().int().positive().optional() }).optional())
    .query(({ input }) => processingGuarantees(input?.applicationId)),
  claimExpressGuarantee: adminQuery.input(z.object({ applicationId: z.number().int().positive() }).strict())
    .mutation(({ input, ctx }) => createExpressGuaranteeRefund(input.applicationId, actorReference(ctx))),
  eligibleSources: staffOrAdminQuery.input(z.object({ applicationId: z.number().int().positive() }))
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

  listByApplication: staffOrAdminQuery.input(z.object({ applicationId: z.number().int().positive() }))
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

  createCase: staffOrAdminQuery.input(z.object({
    applicationId: z.number().int().positive(),
    reason: z.string().trim().min(5).max(500),
    policyVersion: z.string().trim().min(1).max(50),
    items: z.array(itemInput).min(1).max(2),
  })).mutation(async ({ input, ctx }) => getDb().transaction(async (tx) => {
    const [application] = await tx.select({ id: applications.id }).from(applications)
      .where(eq(applications.id, input.applicationId)).limit(1).for("update");
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
    if (!(await verifyNamedStaffPassword(ctx.staffId, input.adminPassword))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator re-authentication failed" });
    }
    await getDb().transaction(async (tx) => {
      const [refundCase] = await tx.select({ applicationId: refundCases.applicationId, requestedBy: refundCases.requestedBy }).from(refundCases)
        .where(and(eq(refundCases.id, input.refundCaseId), eq(refundCases.status, "PENDING_APPROVAL"))).limit(1);
      if (!refundCase) throw new TRPCError({ code: "CONFLICT", message: "Refund case is not awaiting approval" });
      if (refundCase.requestedBy === actorReference(ctx)) throw new TRPCError({ code: 'FORBIDDEN', message: 'A different named administrator must approve this request.' });
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
    if (!(await verifyNamedStaffPassword(ctx.staffId, input.adminPassword))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator re-authentication failed" });
    }

    return executeApprovedRefund(input.refundCaseId, actorReference(ctx));
  }),

  reconcileCase: adminQuery.input(z.object({
    refundCaseId: z.string().uuid(),
    adminPassword: z.string().min(1).max(500),
    confirmation: z.literal("RECONCILE REFUND"),
  })).mutation(async ({ input, ctx }) => {
    if (!(await verifyNamedStaffPassword(ctx.staffId, input.adminPassword))) {
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
      if (pendingItems.some((item) => !item.paymentIntentId)) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe refund reference is incomplete" });
    }

    const newlySucceeded: typeof pendingItems = [];
    for (const item of pendingItems) {
      try {
          const stripeRefund = item.stripeRefundId ? await retrieveStripeRefund(item.stripeRefundId, item.paymentIntentId) : await findStripeRefund(item.paymentIntentId, item.id);
          if (!stripeRefund) {
            if (Date.now() - new Date(refundCase.updatedAt).getTime() < 60_000) throw new Error('Stripe result is not available yet. Wait one minute and check again.');
            await db.update(refundItems).set({ status: 'FAILED', failureCategory: 'not_created', failureMessage: 'Stripe confirms no refund for this request. Return it to the approval queue to retry.' }).where(and(eq(refundItems.id, item.id), eq(refundItems.status, 'PROCESSING')));
            continue;
          }
          if (stripeRefund.amount !== Math.round(Number(item.refundAmount) * 100) || stripeRefund.currency.toUpperCase() !== item.currency.toUpperCase()) throw new Error('Stripe refund amount or currency differs. Investigate before proceeding.');
          item.stripeRefundId = stripeRefund.id;
          await db.update(refundItems).set({ stripeRefundId: stripeRefund.id }).where(eq(refundItems.id, item.id));
        const status = reconcileRefundStatus(stripeRefund.status);
        if (status === "SUCCEEDED" && item.sourceType === "VISA_SERVICE") {
          const result = await completeVisaRefundWithCreditNote(item.id, stripeRefund);
          if (result.changed) newlySucceeded.push(item);
          continue;
        }
        const update = await db.update(refundItems).set({
          status,
          failureCategory: status === "FAILED" ? "stripe_refund_failed" : null,
        }).where(and(eq(refundItems.id, item.id), eq(refundItems.status, "PROCESSING")));
        if (status === "SUCCEEDED" && Number(update[0].affectedRows) === 1) newlySucceeded.push(item);
      } catch (error: unknown) {
        const category = error instanceof Error ? error.message.replace(/^Stripe refund retrieval failed: /u, "").slice(0, 80) : "unknown";
          await db.update(refundItems).set({ failureCategory: category, failureMessage: error instanceof Error ? error.message : 'Unknown reconciliation failure' })
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
