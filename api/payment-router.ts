import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, payments, invoices } from "@db/schema";
import { eq } from "drizzle-orm";

// Stripe secret key from env
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

export const paymentRouter = createRouter({
  // Create payment intent
  createIntent: publicQuery
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

        return { clientSecret: paymentIntent.client_secret };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Payment error";
        return { error: msg };
      }
    }),

  // Confirm payment success
  confirm: publicQuery
    .input(z.object({
      referenceNumber: z.string(),
      paymentIntentId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      // Update application payment status
      await db.update(applications).set({
        paymentStatus: "paid",
      }).where(eq(applications.referenceNumber, input.referenceNumber));

      // Update payment status
      await db.update(payments).set({
        status: "succeeded",
      }).where(eq(payments.stripePaymentIntentId, input.paymentIntentId));

      // Generate invoice
      const [app] = await db.select().from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
      const [payment] = await db.select().from(payments).where(eq(payments.stripePaymentIntentId, input.paymentIntentId)).limit(1);
      
      if (app && payment) {
        const invoiceNumber = `INV-${Date.now()}`;
        await db.insert(invoices).values({
          invoiceNumber,
          applicationId: app.id,
          paymentId: payment.id,
          amount: app.totalAmount,
        });
        
        return { 
          success: true, 
          invoiceNumber,
          referenceNumber: input.referenceNumber,
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
