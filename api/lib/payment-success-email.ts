import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { outboundEmailEvents } from "../../db/schema";
import { getDb } from "../queries/connection";
import { transactionalEmailProvider } from "./email-provider";
import { recipientHash } from "./resend-email";
import { paymentSuccessEmailIdempotencyKey } from "./email-idempotency";

type PaymentSuccessEmailInput = {
  applicationId: number;
  paymentId: number;
  recipient: string;
  referenceNumber: string;
  invoiceNumber: string;
  amountPaid: number;
  currency: string;
};

export async function sendPaymentSuccessEmail(input: PaymentSuccessEmailInput) {
  const db = getDb();
  const [alreadySent] = await db.select({ id: outboundEmailEvents.id }).from(outboundEmailEvents).where(and(
    eq(outboundEmailEvents.applicationId, input.applicationId),
    eq(outboundEmailEvents.template, "PAYMENT_SUCCESS"),
    eq(outboundEmailEvents.status, "SENT"),
  )).limit(1);
  if (alreadySent) return { status: "ALREADY_SENT" as const };

  const provider = transactionalEmailProvider();
  const publicAppUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const variables = {
    referenceNumber: input.referenceNumber,
    invoiceNumber: input.invoiceNumber,
    amountPaid: input.amountPaid.toFixed(2),
    currency: input.currency.toUpperCase(),
    currentStatus: "Paid / Ready for Processing",
    ...(publicAppUrl ? { trackingUrl: `${publicAppUrl}/track?ref=${encodeURIComponent(input.referenceNumber)}` } : {}),
  };
  try {
    const sent = await provider.send({
      recipient: input.recipient,
      template: "PAYMENT_SUCCESS",
      variables,
      idempotencyKey: paymentSuccessEmailIdempotencyKey(input),
    });
    await db.insert(outboundEmailEvents).values({
      id: randomUUID(), applicationId: input.applicationId, template: "PAYMENT_SUCCESS",
      recipientHash: recipientHash(input.recipient), provider: provider.name, status: "SENT",
      providerReference: sent.reference,
    });
    return { status: "SENT" as const };
  } catch {
    await db.insert(outboundEmailEvents).values({
      id: randomUUID(), applicationId: input.applicationId, template: "PAYMENT_SUCCESS",
      recipientHash: recipientHash(input.recipient), provider: provider.name, status: "FAILED",
      failureCategory: "delivery_failed",
    });
    return { status: "FAILED" as const };
  }
}
