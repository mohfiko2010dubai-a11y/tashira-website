import { and, eq } from "drizzle-orm";
import { applications, invoices, payments } from "@db/schema";
import { getDb } from "../queries/connection";
import { saveInvoiceToDisk } from "./invoice-pdf";
import { getErrorMessage } from "./errors";
import { retrieveStripeTestIntent, verifyStripeIntent } from "./stripe";
import { hasTimelineEvent, recordTimelineEvent, type TimelineActorType } from "./application-timeline";
import { activeBusinessSettings, getApplicationPriceSnapshot } from "./pricing-engine";
import { sendPaymentSuccessEmail } from "./payment-success-email";
import { getCanonicalInvoiceCustomerName } from "./invoice-customer-name";

export async function finalizeStripeTestPayment(
  referenceNumber: string,
  paymentIntentId: string,
  evidence: { actorType: TimelineActorType; eventSource: string },
) {
  const db = getDb();
  const [application] = await db.select().from(applications)
    .where(eq(applications.referenceNumber, referenceNumber)).limit(1);
  if (!application) throw new Error("Application not found");

  const [payment] = await db.select().from(payments).where(and(
    eq(payments.stripePaymentIntentId, paymentIntentId),
    eq(payments.applicationId, application.id),
  )).limit(1);
  if (!payment) throw new Error("Payment does not belong to this application");

  const priceSnapshot = await getApplicationPriceSnapshot(application.id);
  if (priceSnapshot.currency.toUpperCase() !== "USD") throw new Error("Stripe payment currency does not match the price snapshot");
  const expectedAmountCents = Math.round(Number(priceSnapshot.totalPrice) * 100);
  const stripeIntent = await retrieveStripeTestIntent(paymentIntentId);
  if (!verifyStripeIntent({ intent: stripeIntent, paymentIntentId, referenceNumber, expectedAmountCents })) {
    throw new Error("Stripe payment verification failed");
  }

  if (application.paymentStatus !== "paid") {
    await db.update(applications).set({ paymentStatus: "paid", status: "payment_received" })
      .where(eq(applications.id, application.id));
    await db.update(payments).set({ status: "succeeded" }).where(eq(payments.id, payment.id));
    await recordTimelineEvent({
      applicationId: application.id,
      paymentId: payment.id,
      eventName: "PAYMENT_CONFIRMED",
      eventSource: evidence.eventSource,
      actorType: evidence.actorType,
      actorReference: paymentIntentId,
      resultingState: "paid",
      summary: "Payment confirmed by Stripe",
    });
    if (await hasTimelineEvent(application.id, "THREE_DS_REQUIRED")) {
      await recordTimelineEvent({
        applicationId: application.id,
        paymentId: payment.id,
        eventName: "THREE_DS_COMPLETED",
        eventSource: evidence.eventSource,
        actorType: "STRIPE",
        actorReference: paymentIntentId,
        resultingState: "succeeded",
        summary: "Required customer authentication completed",
      });
    }
  }

  const invoiceNumber = `INV-${referenceNumber}`;
  const [existingInvoice] = await db.select({ id: invoices.id }).from(invoices)
    .where(eq(invoices.applicationId, application.id)).limit(1);
  if (!existingInvoice) {
    const settings = await activeBusinessSettings();
    try {
      await db.insert(invoices).values({
        invoiceNumber,
        applicationId: application.id,
        paymentId: payment.id,
        amount: payment.amount,
        vatRate: settings.vatRegistered === "yes" ? settings.vatRate : "0.00",
      });
    } catch (error: unknown) {
      const [concurrentInvoice] = await db.select({ id: invoices.id }).from(invoices)
        .where(eq(invoices.invoiceNumber, invoiceNumber)).limit(1);
      if (!concurrentInvoice) throw error;
    }
  }

  const invoiceEventExists = await hasTimelineEvent(application.id, "INVOICE_GENERATED");
  if (!application.invoicePdfPath || !invoiceEventExists) {
    try {
      const customerName = await getCanonicalInvoiceCustomerName(application.id);
      const { pdfPath, pdfUrl } = saveInvoiceToDisk({
        invoiceNumber,
        referenceNumber,
        createdAt: new Date().toISOString(),
        customerName,
        customerEmail: application.contactEmail,
        customerPhone: application.contactPhone,
        visaType: application.visaType,
        processingType: application.processingType,
        arrivalDate: application.arrivalDate || undefined,
        totalAmount: Number(payment.amount),
        stripePaymentIntentId: paymentIntentId,
      });
      await db.update(applications).set({
        invoiceNumber,
        invoicePdfPath: pdfPath,
        invoicePdfUrl: pdfUrl,
      }).where(eq(applications.id, application.id));
      if (!invoiceEventExists) {
        await recordTimelineEvent({
          applicationId: application.id,
          paymentId: payment.id,
          eventName: "INVOICE_GENERATED",
          eventSource: "INVOICE_SERVICE",
          actorType: "SYSTEM",
          actorReference: invoiceNumber,
          resultingState: "generated",
          summary: "Invoice PDF generated",
        });
      }
    } catch (error: unknown) {
      console.error("[Invoice Auto-Gen Error]", getErrorMessage(error));
    }
  }

  await sendPaymentSuccessEmail({
    applicationId: application.id,
    paymentId: payment.id,
    recipient: application.contactEmail,
    referenceNumber,
    invoiceNumber,
    amountPaid: Number(payment.amount),
    currency: payment.currency,
  });

  return {
    applicationId: application.id,
    paymentId: payment.id,
    success: true as const,
    invoiceNumber,
    referenceNumber,
    totalAmount: Number(payment.amount),
    currency: payment.currency.toUpperCase(),
    customerEmail: application.contactEmail,
    customerPhone: application.contactPhone,
    visaType: application.visaType,
    processingType: application.processingType,
    stripePaymentIntentId: paymentIntentId,
  };
}

export async function recordStripeTestPaymentFailure(referenceNumber: string, paymentIntentId: string) {
  const db = getDb();
  const [application] = await db.select({ id: applications.id }).from(applications)
    .where(eq(applications.referenceNumber, referenceNumber)).limit(1);
  if (!application) throw new Error("Application not found");
  const [payment] = await db.select({ id: payments.id }).from(payments).where(and(
    eq(payments.stripePaymentIntentId, paymentIntentId),
    eq(payments.applicationId, application.id),
  )).limit(1);
  if (!payment) throw new Error("Payment does not belong to this application");
  await db.update(payments).set({ status: "failed" }).where(eq(payments.id, payment.id));
  await db.update(applications).set({ paymentStatus: "failed" }).where(eq(applications.id, application.id));
  await recordTimelineEvent({
    applicationId: application.id,
    paymentId: payment.id,
    eventName: "PAYMENT_FAILED",
    eventSource: "STRIPE_WEBHOOK",
    actorType: "STRIPE",
    actorReference: paymentIntentId,
    sanitizedCategory: "unknown",
    resultingState: "failed",
    summary: "Stripe reported payment failure",
  });
  return { applicationId: application.id, paymentId: payment.id };
}
