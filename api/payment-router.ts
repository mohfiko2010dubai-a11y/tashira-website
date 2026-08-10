import { z } from "zod";
import { applicationAccessQuery, createRouter, paymentQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, payments, invoices } from "@db/schema";
import { eq } from "drizzle-orm";
import { auditLog } from "./lib/audit-log";
import { createStripeTestIntent } from "./lib/stripe";
import { assertApplicationReferenceAccess } from "./lib/application-access";
import { finalizeStripeTestPayment } from "./lib/payment-finalization";

export const paymentRouter = createRouter({
  // Create payment intent
  createIntent: paymentQuery
    .input(z.object({
      amount: z.number(), // in cents
      currency: z.string().default("usd"),
      referenceNumber: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        assertApplicationReferenceAccess(ctx, input.referenceNumber);
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
    .mutation(async ({ input, ctx }) => {
      try {
        assertApplicationReferenceAccess(ctx, input.referenceNumber);
        const result = await finalizeStripeTestPayment(input.referenceNumber, input.paymentIntentId);
        auditLog("payment.confirm", "success", "customer");
        return result;
      } catch (error) {
        auditLog("payment.confirm", "failure", "customer");
        throw error;
      }
    }),

  // Get invoice by reference
  getInvoice: applicationAccessQuery
    .input(z.object({ referenceNumber: z.string() }))
    .query(async ({ input, ctx }) => {
      assertApplicationReferenceAccess(ctx, input.referenceNumber);
      const db = getDb();
      const [app] = await db.select().from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
      
      if (!app) return null;
      
      const [invoice] = await db.select().from(invoices).where(eq(invoices.applicationId, app.id)).limit(1);
      
      return invoice || null;
    }),
});
