import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  applicationTimelineEvents,
  applications,
  payments,
  refundCases,
  refundItems,
  securityDepositPayments,
  securityDepositRequests,
} from "@db/schema";
import { adminQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { verifyAdminPassword } from "./lib/admin-session";
import { assertRefundSource, calculateRefund, type RefundDeduction } from "./lib/refund-domain";

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
  listByApplication: adminQuery.input(z.object({ applicationId: z.number().int().positive() }))
    .query(({ input }) => getDb().select().from(refundCases)
      .where(eq(refundCases.applicationId, input.applicationId))
      .orderBy(desc(refundCases.createdAt))),

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
    if (!verifyAdminPassword(input.adminPassword)) {
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
});
