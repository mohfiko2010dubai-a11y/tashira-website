import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { outboundEmailEvents } from "../../db/schema";
import { getDb } from "../queries/connection";
import { transactionalEmailProvider } from "./email-provider";
import { recipientHash } from "./resend-email";
import { paymentSuccessEmailIdempotencyKey } from "./email-idempotency";
import { createInvoiceDownloadUrl } from "./invoice-download-token";
import { publicAppOrigin } from "./public-app-url";
import { recordTimelineEvent } from "./application-timeline";
import { readArchivedInvoice } from "./invoice-archive";
import { paymentEmailRecord } from "./payment-email-record";

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
  const sourceReference = `payment:${input.paymentId}`;
  const record = await paymentEmailRecord(input.applicationId, input.paymentId);
  if (record.alreadySent) return { status: "ALREADY_SENT" as const };

  let providerName = "unavailable";
  try {
    const provider = transactionalEmailProvider();
    providerName = provider.name;
    const publicAppUrl = publicAppOrigin();
    if (!/^[A-Za-z0-9_-]+$/.test(record.invoiceNumber)) throw new Error("Invoice number is invalid");
    const invoicePdf = await readArchivedInvoice(record.invoiceNumber) ?? fs.readFileSync(record.invoicePdfPath);
    if (invoicePdf.length === 0 || invoicePdf.length > 20 * 1024 * 1024 || invoicePdf.subarray(0, 4).toString() !== "%PDF") {
      throw new Error("Invoice attachment is invalid");
    }
    const variables = {
      language: record.language,
      referenceNumber: record.referenceNumber,
      invoiceNumber: record.invoiceNumber,
      amountPaid: record.amountPaid.toFixed(2),
      currency: record.currency.toUpperCase(),
      currentStatus: "Paid / Ready for Processing",
      invoiceUrl: createInvoiceDownloadUrl({
        baseUrl: publicAppUrl,
        invoiceNumber: record.invoiceNumber,
        referenceNumber: record.referenceNumber,
      }),
      trackingUrl: `${publicAppUrl}/${record.language}/track?ref=${encodeURIComponent(record.referenceNumber)}`,
    };
    await recordTimelineEvent({
      applicationId: input.applicationId,
      paymentId: input.paymentId,
      eventName: "INVOICE_DOWNLOAD_LINK_CREATED",
      eventSource: "PAYMENT_EMAIL",
      actorType: "SYSTEM",
      actorReference: record.invoiceNumber,
      resultingState: "issued",
      summary: "Short-lived invoice download capability created",
    });
    const sent = await provider.send({
      recipient: record.recipient,
      template: "PAYMENT_SUCCESS",
      variables,
      idempotencyKey: paymentSuccessEmailIdempotencyKey(input),
      attachments: [{
        filename: `${record.invoiceNumber}.pdf`,
        content: invoicePdf.toString("base64"),
      }],
    });
    await db.insert(outboundEmailEvents).values({
      id: randomUUID(), applicationId: input.applicationId, template: "PAYMENT_SUCCESS", sourceReference,
      recipientHash: recipientHash(record.recipient), provider: provider.name, status: "SENT",
      providerReference: sent.reference,
    });
    return { status: "SENT" as const };
  } catch {
    await db.insert(outboundEmailEvents).values({
      id: randomUUID(), applicationId: input.applicationId, template: "PAYMENT_SUCCESS", sourceReference,
      recipientHash: recipientHash(record.recipient), provider: providerName, status: "FAILED",
      failureCategory: "invoice_delivery_failed",
    });
    return { status: "FAILED" as const };
  }
}
