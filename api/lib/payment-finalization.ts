import { and, eq } from "drizzle-orm";
import { applications, invoices, payments } from "@db/schema";
import { getDb } from "../queries/connection";
import { saveInvoiceToDisk } from "./invoice-pdf";
import { getErrorMessage } from "./errors";
import { retrieveStripeTestIntent, verifyStripeIntent } from "./stripe";
import { hasTimelineEvent, recordTimelineEvent, type TimelineActorType } from "./application-timeline";
import { activeBusinessSettings, getApplicationPriceSnapshot } from "./pricing-engine";
import { sendPaymentSuccessEmail } from "./payment-success-email";
import { getCanonicalInvoiceCustomerIdentity } from "./invoice-customer-name";
import { getPayerEvidence } from "./payer-authorization";
import { retrieveStripeTestCardSummary } from "./stripe";
import { applyStripePaymentState, SupersededStripeEvent } from "./payment-state";

export async function finalizeStripeTestPayment(
  referenceNumber: string,
  paymentIntentId: string,
  evidence: { actorType: TimelineActorType; eventSource: string; eventCreated?: number },
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

  const transition = await applyStripePaymentState({ applicationId: application.id, paymentId: payment.id,
    paymentIntentId, target: "paid", ...evidence });
  if (!transition.paid) throw new SupersededStripeEvent("A newer payment event supersedes this confirmation");
  if (transition.applied) {
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
  let invoicePdfPath = application.invoicePdfPath || "";
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
      const [customerIdentity, payerEvidence, cardSummary] = await Promise.all([
        getCanonicalInvoiceCustomerIdentity(application.id),
        getPayerEvidence(application.id, payment.id),
        retrieveStripeTestCardSummary(paymentIntentId).catch(() => null),
      ]);
      if (!payerEvidence) throw new Error("Verified payer authorization evidence is unavailable for invoice generation");
      const { pdfPath, pdfUrl } = saveInvoiceToDisk({
        invoiceNumber,
        referenceNumber,
        createdAt: new Date().toISOString(),
        customerName: customerIdentity.fullName,
        customerEmail: application.contactEmail,
        customerPhone: application.contactPhone,
        nationality: customerIdentity.nationality,
        passportNumber: customerIdentity.passportNumber,
        passportExpiry: customerIdentity.passportExpiry,
        visaType: application.visaType,
        processingType: application.processingType,
        arrivalDate: application.arrivalDate || undefined,
        applicantCount: priceSnapshot.applicantCount,
        unitPriceInBaseCurrency: Number(priceSnapshot.unitPrice) * Number(priceSnapshot.exchangeRateToBase),
        baseCurrency: priceSnapshot.baseCurrency.toUpperCase(),
        exchangeRateToBase: Number(priceSnapshot.exchangeRateToBase),
        totalAmount: Number(payment.amount),
        currency: payment.currency.toUpperCase(),
        stripePaymentIntentId: paymentIntentId,
        payerName: payerEvidence.payerName,
        payerRelationship: payerEvidence.relationship,
        cardBrand: cardSummary?.brand,
        cardLast4: cardSummary?.last4,
      });
      invoicePdfPath = pdfPath;
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
    invoicePdfPath,
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

export async function recordStripeTestPaymentFailure(referenceNumber: string, paymentIntentId: string, eventCreated: number) {
  const db = getDb();
  const [application] = await db.select({ id: applications.id }).from(applications)
    .where(eq(applications.referenceNumber, referenceNumber)).limit(1);
  if (!application) throw new Error("Application not found");
  const [payment] = await db.select({ id: payments.id }).from(payments).where(and(
    eq(payments.stripePaymentIntentId, paymentIntentId),
    eq(payments.applicationId, application.id),
  )).limit(1);
  if (!payment) throw new Error("Payment does not belong to this application");
  const transition = await applyStripePaymentState({ applicationId: application.id, paymentId: payment.id,
    paymentIntentId, target: "failed", eventCreated, eventSource: "STRIPE_WEBHOOK", actorType: "STRIPE" });
  return { applicationId: application.id, paymentId: payment.id, ignored: !transition.applied };
}
