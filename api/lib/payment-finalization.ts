import { and, eq } from "drizzle-orm";
import { applications, invoices, payments } from "@db/schema";
import { getDb } from "../queries/connection";
import { saveInvoiceToDisk } from "./invoice-pdf";
import { getErrorMessage } from "./errors";
import { retrieveStripeTestIntent, verifyStripeIntent } from "./stripe";

export async function finalizeStripeTestPayment(referenceNumber: string, paymentIntentId: string) {
  const db = getDb();
  const [application] = await db.select().from(applications)
    .where(eq(applications.referenceNumber, referenceNumber)).limit(1);
  if (!application) throw new Error("Application not found");

  const [payment] = await db.select().from(payments).where(and(
    eq(payments.stripePaymentIntentId, paymentIntentId),
    eq(payments.applicationId, application.id),
  )).limit(1);
  if (!payment) throw new Error("Payment does not belong to this application");

  const expectedAmountCents = Math.round(Number(application.totalAmountUsd) * 100);
  const stripeIntent = await retrieveStripeTestIntent(paymentIntentId);
  if (!verifyStripeIntent({ intent: stripeIntent, paymentIntentId, referenceNumber, expectedAmountCents })) {
    throw new Error("Stripe payment verification failed");
  }

  if (application.paymentStatus !== "paid") {
    await db.update(applications).set({ paymentStatus: "paid", status: "payment_received" })
      .where(eq(applications.id, application.id));
    await db.update(payments).set({ status: "succeeded" }).where(eq(payments.id, payment.id));
  }

  const invoiceNumber = `INV-${referenceNumber}`;
  const [existingInvoice] = await db.select({ id: invoices.id }).from(invoices)
    .where(eq(invoices.applicationId, application.id)).limit(1);
  if (!existingInvoice) {
    try {
      await db.insert(invoices).values({
        invoiceNumber,
        applicationId: application.id,
        paymentId: payment.id,
        amount: payment.amount,
      });
    } catch (error: unknown) {
      const [concurrentInvoice] = await db.select({ id: invoices.id }).from(invoices)
        .where(eq(invoices.invoiceNumber, invoiceNumber)).limit(1);
      if (!concurrentInvoice) throw error;
    }
  }

  try {
    const { pdfPath, pdfUrl } = saveInvoiceToDisk({
      invoiceNumber,
      referenceNumber,
      createdAt: new Date().toISOString(),
      customerName: application.contactEmail.split("@")[0] || "Customer",
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
  } catch (error: unknown) {
    console.error("[Invoice Auto-Gen Error]", getErrorMessage(error));
  }

  return {
    success: true as const,
    invoiceNumber,
    referenceNumber,
    totalAmount: Number(payment.amount),
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
}
