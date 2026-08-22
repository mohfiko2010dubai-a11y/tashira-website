import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
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
  const [alreadySent] = await db.select({ id: outboundEmailEvents.id })
    .from(outboundEmailEvents).where(and(
      eq(outboundEmailEvents.template, "REFUND_COMPLETED"),
      eq(outboundEmailEvents.sourceReference, sourceReference),
      eq(outboundEmailEvents.status, "SENT"),
    )).limit(1);
  if (alreadySent) return { status: "ALREADY_SENT" as const };

  let providerName = "unavailable";
  try {
    const provider = transactionalEmailProvider();
    providerName = provider.name;
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
    try {
      await db.insert(outboundEmailEvents).values({
        id: crypto.randomUUID(), applicationId: details.applicationId, template: "REFUND_COMPLETED",
        sourceReference, recipientHash: recipientHash(details.recipient), provider: provider.name,
        status: "SENT", providerReference: sent.reference,
      });
    } catch {
      const [concurrentSent] = await db.select({ id: outboundEmailEvents.id }).from(outboundEmailEvents).where(and(
        eq(outboundEmailEvents.template, "REFUND_COMPLETED"),
        eq(outboundEmailEvents.sourceReference, sourceReference),
        eq(outboundEmailEvents.status, "SENT"),
      )).limit(1);
      if (concurrentSent) return { status: "ALREADY_SENT" as const };
      throw new Error("Refund email evidence could not be recorded");
    }
    return { status: "SENT" as const };
  } catch {
    await db.insert(outboundEmailEvents).values({
      id: crypto.randomUUID(), applicationId: details.applicationId, template: "REFUND_COMPLETED",
      sourceReference, recipientHash: recipientHash(details.recipient), provider: providerName,
      status: "FAILED", failureCategory: "refund_delivery_failed",
    });
    return { status: "FAILED" as const };
  }
}
