import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { and, eq } from "drizzle-orm";
import { outboundEmailEvents } from "../../db/schema";
import { getDb } from "../queries/connection";
import { transactionalEmailProvider } from "./email-provider";
import { recipientHash } from "./resend-email";
import { paymentSuccessEmailIdempotencyKey } from "./email-idempotency";
import { createInvoiceDownloadUrl } from "./invoice-download-token";
import { publicAppOrigin } from "./public-app-url";
import { recordTimelineEvent } from "./application-timeline";

type PaymentSuccessEmailInput = {
  applicationId: number;
  paymentId: number;
  recipient: string;
  referenceNumber: string;
  invoiceNumber: string;
  amountPaid: number;
  currency: string;
  invoicePdfPath: string;
};

export async function sendPaymentSuccessEmail(input: PaymentSuccessEmailInput) {
  const db = getDb();
  const [alreadySent] = await db.select({ id: outboundEmailEvents.id }).from(outboundEmailEvents).where(and(
    eq(outboundEmailEvents.applicationId, input.applicationId),
    eq(outboundEmailEvents.template, "PAYMENT_SUCCESS"),
    eq(outboundEmailEvents.status, "SENT"),
  )).limit(1);
  if (alreadySent) return { status: "ALREADY_SENT" as const };

  let providerName = "unavailable";
  try {
    const provider = transactionalEmailProvider();
    providerName = provider.name;
    const publicAppUrl = publicAppOrigin();
    if (!/^[A-Za-z0-9_-]+$/.test(input.invoiceNumber)) throw new Error("Invoice number is invalid");
    const invoicePdf = fs.readFileSync(input.invoicePdfPath);
    if (invoicePdf.length === 0 || invoicePdf.length > 20 * 1024 * 1024 || invoicePdf.subarray(0, 4).toString() !== "%PDF") {
      throw new Error("Invoice attachment is invalid");
    }
    const variables = {
      referenceNumber: input.referenceNumber,
      invoiceNumber: input.invoiceNumber,
      amountPaid: input.amountPaid.toFixed(2),
      currency: input.currency.toUpperCase(),
      currentStatus: "Paid / Ready for Processing",
      invoiceUrl: createInvoiceDownloadUrl({
        baseUrl: publicAppUrl,
        invoiceNumber: input.invoiceNumber,
        referenceNumber: input.referenceNumber,
      }),
      trackingUrl: `${publicAppUrl}/track?ref=${encodeURIComponent(input.referenceNumber)}`,
    };
    await recordTimelineEvent({
      applicationId: input.applicationId,
      paymentId: input.paymentId,
      eventName: "INVOICE_DOWNLOAD_LINK_CREATED",
      eventSource: "PAYMENT_EMAIL",
      actorType: "SYSTEM",
      actorReference: input.invoiceNumber,
      resultingState: "issued",
      summary: "Short-lived invoice download capability created",
    });
    const sent = await provider.send({
      recipient: input.recipient,
      template: "PAYMENT_SUCCESS",
      variables,
      idempotencyKey: paymentSuccessEmailIdempotencyKey(input),
      attachments: [{
        filename: `${input.invoiceNumber}.pdf`,
        content: invoicePdf.toString("base64"),
      }],
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
      recipientHash: recipientHash(input.recipient), provider: providerName, status: "FAILED",
      failureCategory: "invoice_delivery_failed",
    });
    return { status: "FAILED" as const };
  }
}
