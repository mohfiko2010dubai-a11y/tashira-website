import crypto from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { applicationTimelineEvents, financialEvents, payments, refundCases, refundItems, securityDepositPayments, securityDepositRequests } from '@db/schema';
import { getDb } from '../queries/connection';
import { createStripeRefund, StripeRefundRejected } from './stripe';
import { completeVisaRefundWithCreditNote } from './refund-credit-note';
import { sendRefundOutcomeEmail } from './refund-outcome-email';
import { refundChargeSummary } from './refund-provider-summary';

/** Atomic claim + immutable provider idempotency key; shared by approved manual and objective automatic refunds. */
export async function executeApprovedRefund(refundCaseId: string, actor: string) {
    const db = getDb();
    const claimed = await db.transaction(async (tx) => {
      const [refundCase] = await tx.select().from(refundCases)
        .where(eq(refundCases.id, refundCaseId)).limit(1);
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
      let acceptedRefundId: string | undefined;
      let requestStarted = false;
      try {
        const provider = await refundChargeSummary(item.paymentIntentId);
        if (provider.currency !== item.currency.toUpperCase() || provider.remainingMinor < Math.round(Number(item.refundAmount) * 100)) throw new Error('The Stripe charge has insufficient refundable balance. Refresh the charge and review existing refunds.');
        requestStarted = true;
        const stripeRefund = await createStripeRefund({
          paymentIntentId: item.paymentIntentId,
          amountCents: Math.round(Number(item.refundAmount) * 100),
          idempotencyKey: item.idempotencyKey,
          metadata: { refundCaseId: claimed.refundCase.id, refundItemId: item.id, sourceType: item.sourceType },
        });
        acceptedRefundId = stripeRefund.id;
        const itemStatus = stripeRefund.status === "succeeded" ? "SUCCEEDED" : "PROCESSING";
        // Preserve the provider reference before accounting, so a local failure can be reconciled.
        await db.update(refundItems).set({ status: "PROCESSING", stripeRefundId: stripeRefund.id, failureCategory: null, failureMessage: null })
          .where(and(eq(refundItems.id, item.id), eq(refundItems.status, "PROCESSING")));
        if (itemStatus === "SUCCEEDED" && item.sourceType === "VISA_SERVICE") {
          await completeVisaRefundWithCreditNote(item.id, stripeRefund);
        } else if (itemStatus === "SUCCEEDED") {
          await db.update(refundItems).set({ status: itemStatus }).where(and(eq(refundItems.id, item.id), eq(refundItems.status, "PROCESSING")));
        }
        if (itemStatus === "SUCCEEDED") succeeded += 1;
        else processing += 1;
      } catch (error: unknown) {
        const category = error instanceof Error ? error.message.replace(/^Stripe refund failed: /u, "").slice(0, 80) : "unknown";
        const uncertain = Boolean(acceptedRefundId) || (requestStarted && !(error instanceof StripeRefundRejected));
        if (uncertain) processing += 1;
        await db.update(refundItems).set({ status: uncertain ? "PROCESSING" : "FAILED",
          ...(acceptedRefundId ? { stripeRefundId: acceptedRefundId } : {}), failureCategory: acceptedRefundId ? "accounting_pending" : category,
          failureMessage: error instanceof Error ? error.message : 'Unknown execution failure' })
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
          actorReference: actor,
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
          actorReference: actor,
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
}
