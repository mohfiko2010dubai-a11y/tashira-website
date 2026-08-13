import { z } from "zod";
import { applicationAccessQuery, createRouter, paymentQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, payments, invoices } from "@db/schema";
import { eq } from "drizzle-orm";
import { auditLog } from "./lib/audit-log";
import { createStripeTestIntent } from "./lib/stripe";
import { assertApplicationReferenceAccess } from "./lib/application-access";
import { finalizeStripeTestPayment } from "./lib/payment-finalization";
import { recordTimelineEvent } from "./lib/application-timeline";
import { getApplicationPriceSnapshot } from "./lib/pricing-engine";
import { TRPCError } from "@trpc/server";
import { getApplicationReadiness } from "./lib/application-readiness";

export const paymentRouter = createRouter({
  // Create payment intent
  createIntent: paymentQuery
    .input(z.object({
      amount: z.number().optional(), // Legacy client hint; never trusted.
      currency: z.string().optional(), // Legacy client hint; never trusted.
      referenceNumber: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        assertApplicationReferenceAccess(ctx, input.referenceNumber);
        const db = getDb();
        const [app] = await db.select().from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
        if (!app) throw new Error("Application not found");
        if (app.paymentStatus === "paid") {
          throw new TRPCError({ code: "CONFLICT", message: "Application is already paid" });
        }
        const readiness = await getApplicationReadiness(app.id);
        if (readiness.status !== "READY") {
          auditLog("payment.readiness_rejected", "failure", "customer");
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: JSON.stringify({ code: "APPLICATION_INCOMPLETE", ...readiness }),
          });
        }

        const priceSnapshot = await getApplicationPriceSnapshot(app.id);
        if (priceSnapshot.currency.toUpperCase() !== "USD") throw new Error("Stripe checkout requires a USD price snapshot");
        const serverAmountUsd = Number(priceSnapshot.totalPrice);
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
        let paymentId = existingPayment?.id;
        if (!paymentId) {
          const [createdPayment] = await db.insert(payments).values({
            applicationId: app.id,
            stripePaymentIntentId: paymentIntent.id,
            amount: serverAmountUsd.toFixed(2),
            currency: "usd",
            status: "pending",
          }).$returningId();
          paymentId = createdPayment.id;
        }
        await db.update(applications).set({
          stripePaymentIntentId: paymentIntent.id,
          stripeAmountUsd: serverAmountUsd.toFixed(2),
        }).where(eq(applications.id, app.id));
        await recordTimelineEvent({
          applicationId: app.id,
          paymentId,
          eventName: "PAYMENT_INTENT_CREATED",
          eventSource: "PAYMENT_API",
          actorType: "SYSTEM",
          actorReference: paymentIntent.id,
          resultingState: "pending",
          summary: "Stripe PaymentIntent created",
        });

        auditLog("payment.intent_create", "success", "customer");
        return { clientSecret: paymentIntent.client_secret };
      } catch (err: unknown) {
        auditLog("payment.intent_create", "failure", "customer");
        if (err instanceof TRPCError) throw err;
        const msg = err instanceof Error ? err.message : "Payment error";
        throw new TRPCError({ code: "BAD_REQUEST", message: msg });
      }
    }),

  readiness: applicationAccessQuery
    .input(z.object({ referenceNumber: z.string() }))
    .query(async ({ input, ctx }) => {
      assertApplicationReferenceAccess(ctx, input.referenceNumber);
      const db = getDb();
      const [app] = await db.select({ id: applications.id, paymentStatus: applications.paymentStatus })
        .from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      return { paymentStatus: app.paymentStatus, ...(await getApplicationReadiness(app.id)) };
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
        const result = await finalizeStripeTestPayment(input.referenceNumber, input.paymentIntentId, {
          actorType: "CUSTOMER",
          eventSource: "PAYMENT_CONFIRM_API",
        });
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
