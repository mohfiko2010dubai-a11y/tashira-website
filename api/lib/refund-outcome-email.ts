import crypto from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { applications, outboundEmailEvents, refundCases, refundItems } from "../../db/schema";
import { getDb } from "../queries/connection";
import { transactionalEmailProvider } from "./email-provider";
import { recipientHash } from "./resend-email";
import { refundOutcomeEmailIdempotencyKey } from "./email-idempotency";

export async function sendRefundOutcomeEmail(refundCaseId: string) {
  const db = getDb();
  const [details] = await db.select({
    applicationId: refundCases.applicationId,
    status: refundCases.status,
    referenceNumber: applications.referenceNumber,
    recipient: applications.contactEmail,
  }).from(refundCases)
    .innerJoin(applications, eq(applications.id, refundCases.applicationId))
    .where(eq(refundCases.id, refundCaseId)).limit(1);
  if (!details || !["REFUNDED", "PARTIALLY_REFUNDED"].includes(details.status)) {
    return { status: "NOT_APPLICABLE" as const };
  }

  const succeededItems = await db.select({ amount: refundItems.refundAmount, currency: refundItems.currency })
    .from(refundItems).where(and(eq(refundItems.refundCaseId, refundCaseId), eq(refundItems.status, "SUCCEEDED")));
  if (succeededItems.length === 0) return { status: "NOT_APPLICABLE" as const };

  const totals = new Map<string, number>();
  for (const item of succeededItems) totals.set(item.currency, (totals.get(item.currency) || 0) + Number(item.amount));
  const refundSummary = [...totals].map(([currency, amount]) => `${currency} ${amount.toFixed(2)}`).join(" and ");
  const sourceReference = refundOutcomeEmailIdempotencyKey(refundCaseId);
  const claimId = crypto.randomUUID();
  await db.insert(outboundEmailEvents).values({
    id: claimId,
    applicationId: details.applicationId,
    template: "REFUND_COMPLETED",
    sourceReference,
    recipientHash: recipientHash(details.recipient),
    provider: "pending",
    status: "QUEUED",
  }).onDuplicateKeyUpdate({ set: { id: sql`${outboundEmailEvents.id}` } });

  const [claim] = await db.select({ id: outboundEmailEvents.id, status: outboundEmailEvents.status })
    .from(outboundEmailEvents).where(and(
      eq(outboundEmailEvents.template, "REFUND_COMPLETED"),
      eq(outboundEmailEvents.sourceReference, sourceReference),
    )).limit(1);
  if (!claim) throw new Error("Refund email claim was not recorded");
  if (claim.id !== claimId) {
    if (claim.status === "SENT") return { status: "ALREADY_SENT" as const };
    if (claim.status === "QUEUED") return { status: "IN_PROGRESS" as const };
    const reclaimed = await db.update(outboundEmailEvents).set({ status: "QUEUED", failureCategory: null })
      .where(and(eq(outboundEmailEvents.id, claim.id), inArray(outboundEmailEvents.status, ["FAILED", "SUPPRESSED"])));
    if (Number(reclaimed[0].affectedRows) !== 1) return { status: "IN_PROGRESS" as const };
  }

  try {
    const provider = transactionalEmailProvider();
    await db.update(outboundEmailEvents).set({ provider: provider.name })
      .where(and(eq(outboundEmailEvents.id, claim.id), eq(outboundEmailEvents.status, "QUEUED")));
    const sent = await provider.send({
      recipient: details.recipient,
      template: "REFUND_COMPLETED",
      idempotencyKey: sourceReference,
      variables: {
        referenceNumber: details.referenceNumber,
        refundSummary,
        statusLabel: details.status === "REFUNDED" ? "Refunded" : "Partially Refunded",
      },
    });
    await db.update(outboundEmailEvents).set({ status: "SENT", providerReference: sent.reference, failureCategory: null })
      .where(and(eq(outboundEmailEvents.id, claim.id), eq(outboundEmailEvents.status, "QUEUED")));
    return { status: "SENT" as const };
  } catch {
    await db.update(outboundEmailEvents).set({ status: "FAILED", failureCategory: "refund_delivery_failed" })
      .where(and(eq(outboundEmailEvents.id, claim.id), eq(outboundEmailEvents.status, "QUEUED")));
    return { status: "FAILED" as const };
  }
}
