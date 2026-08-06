import { z } from "zod";
import { createRouter, paymentQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, payments, invoices } from "@db/schema";
import { eq } from "drizzle-orm";
import { saveInvoiceToDisk } from "./lib/invoice-pdf";
import { getErrorMessage } from "./lib/errors";
import { auditLog } from "./lib/audit-log";

// Stripe secret key from env
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

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
        const response = await fetch("https://api.stripe.com/v1/payment_intents", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            amount: String(input.amount),
            currency: input.currency,
            "automatic_payment_methods[enabled]": "true",
            "metadata[referenceNumber]": input.referenceNumber,
          }),
        });

        if (!response.ok) {
          const errData = await response.json() as { error?: { message?: string } };
          throw new Error(errData.error?.message || "Stripe error");
        }

        const paymentIntent = await response.json() as { id: string; client_secret: string };
        
        // Store in DB
        const db = getDb();
        const [app] = await db.select().from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
        
        if (app) {
          await db.insert(payments).values({
            applicationId: app.id,
            stripePaymentIntentId: paymentIntent.id,
            amount: String(input.amount / 100),
            currency: input.currency,
            status: "pending",
          });
          
          await db.update(applications).set({
            stripePaymentIntentId: paymentIntent.id,
          }).where(eq(applications.id, app.id));
        }

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
      const db = getDb();
      
      // Update application payment status
      await db.update(applications).set({
        paymentStatus: "paid",
        status: "payment_received",
      }).where(eq(applications.referenceNumber, input.referenceNumber));

      // Update payment status
      await db.update(payments).set({
        status: "succeeded",
      }).where(eq(payments.stripePaymentIntentId, input.paymentIntentId));
      auditLog("payment.confirm", "success", "customer");

      // Generate invoice
      const [app] = await db.select().from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
      const [payment] = await db.select().from(payments).where(eq(payments.stripePaymentIntentId, input.paymentIntentId)).limit(1);
      
      if (app && payment) {
        const invoiceNumber = `INV-${input.referenceNumber}`;
        
        // Insert invoice record - ensure paymentId is valid number
        const paymentIdNum = typeof payment.id === 'bigint' ? Number(payment.id) : payment.id;
        const appIdNum = typeof app.id === 'bigint' ? Number(app.id) : app.id;
        
        try {
          await db.insert(invoices).values({
            invoiceNumber,
            applicationId: appIdNum,
            paymentId: paymentIdNum,
            amount: payment.amount,
          });
        } catch (invoiceErr: unknown) {
          console.error("[Invoice Insert Error]", getErrorMessage(invoiceErr));
          // Don't fail payment if invoice insert fails
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
      }

      return { success: true };
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
