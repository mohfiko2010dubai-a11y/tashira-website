import { z } from "zod";
import { createRouter, paymentQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, payments, invoices } from "@db/schema";
import { and, eq } from "drizzle-orm";
import { saveInvoiceToDisk } from "./lib/invoice-pdf";
import { getErrorMessage } from "./lib/errors";
import { auditLog } from "./lib/audit-log";
import { createStripeTestIntent, retrieveStripeTestIntent, verifyStripeIntent } from "./lib/stripe";

export const paymentRouter = createRouter({
  // Create payment intent
  createIntent: paymentQuery
    .input(z.object({
      amount: z.number(), // in cents
      currency: z.string().default("usd"),
      referenceNumber: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDb();
        const [app] = await db.select().from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
        if (!app) throw new Error("Application not found");
        if (app.paymentStatus === "paid") throw new Error("Application is already paid");

        const serverAmountUsd = Number(app.totalAmountUsd);
        if (!Number.isFinite(serverAmountUsd) || serverAmountUsd <= 0) {
          throw new Error("Application amount is invalid");
        }
        const amountCents = Math.round(serverAmountUsd * 100);
        const paymentIntent = await createStripeTestIntent({
          amountCents,
          referenceNumber: app.referenceNumber,
          idempotencyKey: `tashira-application-${app.id}`,
        });
        if (!paymentIntent.client_secret) throw new Error("Stripe did not return a client secret");

        const [existingPayment] = await db.select({ id: payments.id }).from(payments)
          .where(eq(payments.stripePaymentIntentId, paymentIntent.id)).limit(1);
        if (!existingPayment) {
          await db.insert(payments).values({
            applicationId: app.id,
            stripePaymentIntentId: paymentIntent.id,
            amount: serverAmountUsd.toFixed(2),
            currency: "usd",
            status: "pending",
          });
        }
        await db.update(applications).set({
          stripePaymentIntentId: paymentIntent.id,
          stripeAmountUsd: serverAmountUsd.toFixed(2),
        }).where(eq(applications.id, app.id));

        auditLog("payment.intent_create", "success", "customer");
        return { clientSecret: paymentIntent.client_secret };
      } catch (err: unknown) {
        auditLog("payment.intent_create", "failure", "customer");
        const msg = err instanceof Error ? err.message : "Payment error";
        return { error: msg };
      }
    }),

  // Confirm payment success
  confirm: paymentQuery
    .input(z.object({
      referenceNumber: z.string(),
      paymentIntentId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDb();
        const [app] = await db.select().from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
        if (!app) throw new Error("Application not found");

        const [payment] = await db.select().from(payments).where(and(
          eq(payments.stripePaymentIntentId, input.paymentIntentId),
          eq(payments.applicationId, app.id),
        )).limit(1);
        if (!payment) throw new Error("Payment does not belong to this application");

        const expectedAmountCents = Math.round(Number(app.totalAmountUsd) * 100);
        const stripeIntent = await retrieveStripeTestIntent(input.paymentIntentId);
        if (!verifyStripeIntent({
          intent: stripeIntent,
          paymentIntentId: input.paymentIntentId,
          referenceNumber: input.referenceNumber,
          expectedAmountCents,
        })) {
          throw new Error("Stripe payment verification failed");
        }

        if (app.paymentStatus !== "paid") {
          await db.update(applications).set({
            paymentStatus: "paid",
            status: "payment_received",
          }).where(eq(applications.id, app.id));
          await db.update(payments).set({ status: "succeeded" }).where(eq(payments.id, payment.id));
        }
        auditLog("payment.confirm", "success", "customer");
      
        const invoiceNumber = `INV-${input.referenceNumber}`;
        
        // Insert invoice record - ensure paymentId is valid number
        const paymentIdNum = typeof payment.id === 'bigint' ? Number(payment.id) : payment.id;
        const appIdNum = typeof app.id === 'bigint' ? Number(app.id) : app.id;
        
        const [existingInvoice] = await db.select({ id: invoices.id }).from(invoices)
          .where(eq(invoices.applicationId, app.id)).limit(1);
        if (!existingInvoice) {
          await db.insert(invoices).values({
            invoiceNumber,
            applicationId: appIdNum,
            paymentId: paymentIdNum,
            amount: payment.amount,
          });
        }

        // Auto-generate PDF server-side
        try {
          const { pdfPath, pdfUrl } = saveInvoiceToDisk({
            invoiceNumber,
            referenceNumber: input.referenceNumber,
            createdAt: new Date().toISOString(),
            customerName: app.contactEmail.split("@")[0] || "Customer",
            customerEmail: app.contactEmail,
            customerPhone: app.contactPhone,
            visaType: app.visaType,
            processingType: app.processingType,
            arrivalDate: app.arrivalDate || undefined,
            totalAmount: Number(payment.amount),
            stripePaymentIntentId: input.paymentIntentId,
          });

          // Update application with invoice info
          await db.update(applications).set({
            invoiceNumber,
            invoicePdfPath: pdfPath,
            invoicePdfUrl: pdfUrl,
          }).where(eq(applications.id, app.id));

          console.log(`[Invoice] Generated: ${pdfPath}`);
        } catch (pdfErr: unknown) {
          console.error("[Invoice Auto-Gen Error]", getErrorMessage(pdfErr));
          // Don't fail payment if invoice generation fails
        }
        
        return { 
          success: true, 
          invoiceNumber,
          referenceNumber: input.referenceNumber,
          totalAmount: Number(payment.amount),
          customerEmail: app.contactEmail,
          customerPhone: app.contactPhone,
          visaType: app.visaType,
          processingType: app.processingType,
          stripePaymentIntentId: input.paymentIntentId,
        };
      } catch (error) {
        auditLog("payment.confirm", "failure", "customer");
        throw error;
      }
    }),

  // Get invoice by reference
  getInvoice: publicQuery
    .input(z.object({ referenceNumber: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [app] = await db.select().from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
      
      if (!app) return null;
      
      const [invoice] = await db.select().from(invoices).where(eq(invoices.applicationId, app.id)).limit(1);
      
      return invoice || null;
    }),
});
