import { z } from "zod";
import { applicationAccessQuery, createRouter, paymentQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, applicants, payments, invoices } from "@db/schema";
import { asc, eq } from "drizzle-orm";
import { auditLog } from "./lib/audit-log";
import { createStripeTestIntent, retrieveStripeTestIntent } from "./lib/stripe";
import { drizzle } from "drizzle-orm/mysql2";
import { assertApplicationReferenceAccess } from "./lib/application-access";
import { finalizeStripeTestPayment } from "./lib/payment-finalization";
import { hasTimelinePolicyAcceptance, recordTimelineEvent } from "./lib/application-timeline";
import { TERMS_POLICY_VERSION } from "@contracts/constants";
import { getApplicationPriceSnapshot } from "./lib/pricing-engine";
import { TRPCError } from "@trpc/server";
import { getApplicationReadiness } from "./lib/application-readiness";
import { recordPayerAuthorization } from "./lib/payer-authorization";
import { validatePayerAuthorization } from "./lib/payer-authorization-core";
import { PAYER_AUTHORIZATION_VERSION, PAYER_RELATIONSHIPS } from "@contracts/payer-authorization";
import { assertDisplayedQuote, refreshCheckoutQuote, withCheckoutLock } from "./lib/checkout-quote";
import { assertSafeIntentRetry, checkoutPaymentAttempt, reserveCheckoutPayment } from "./lib/checkout-payment-attempt";

export const paymentRouter = createRouter({
  status: applicationAccessQuery.input(z.object({ referenceNumber: z.string() })).query(async ({ input, ctx }) => {
    assertApplicationReferenceAccess(ctx, input.referenceNumber);
    const [app] = await getDb().select().from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found. Reopen your saved application." });
    if (app.paymentStatus === "paid") return { status: "paid", paymentIntentId: app.stripePaymentIntentId };
    if (!app.stripePaymentIntentId) return { status: "not_started", paymentIntentId: null };
    const intent = await retrieveStripeTestIntent(app.stripePaymentIntentId);
    const quote = await getApplicationPriceSnapshot(app.id);
    if (intent.metadata.referenceNumber !== app.referenceNumber || intent.currency !== "usd" || intent.amount !== Math.round(Number(quote.totalPrice) * 100)) {
      throw new TRPCError({ code: "CONFLICT", message: "Your saved payment needs verification. Contact support before trying again." });
    }
    return { status: intent.status, paymentIntentId: intent.id };
  }),
  quote: applicationAccessQuery.input(z.object({ referenceNumber: z.string() })).query(async ({ input, ctx }) => {
    assertApplicationReferenceAccess(ctx, input.referenceNumber);
    const [app] = await getDb().select({ id: applications.id, paymentStatus: applications.paymentStatus }).from(applications)
      .where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found. Reopen your saved application." });
    if (app.paymentStatus === "paid") {
      const snapshot = await getApplicationPriceSnapshot(app.id);
      return { quoteId: snapshot.id, amount: Number(snapshot.totalPrice), currency: snapshot.currency, applicantCount: snapshot.applicantCount };
    }
    return withCheckoutLock(app.id, async connection => {
      const current = await refreshCheckoutQuote(connection, app.id);
      return { quoteId: current.id, amount: current.quote.totalPrice, currency: current.quote.currency, applicantCount: current.quote.applicantCount };
    });
  }),
  acceptPolicies: paymentQuery.input(z.object({ referenceNumber: z.string(), accepted: z.literal(true), policyVersion: z.literal(TERMS_POLICY_VERSION) }).strict())
    .mutation(async ({ input, ctx }) => {
      assertApplicationReferenceAccess(ctx, input.referenceNumber);
      const [app] = await getDb().select({ id: applications.id }).from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
      if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      if (!await hasTimelinePolicyAcceptance(app.id, input.policyVersion)) await recordTimelineEvent({ applicationId: app.id,
        eventName: "POLICY_ACCEPTED", eventSource: "PAYMENT_API", actorType: "CUSTOMER", policyVersion: input.policyVersion,
        summary: "Customer explicitly accepted the displayed terms, privacy and refund policies at checkout" });
      return { accepted: true as const };
    }),
  // Create payment intent
  createIntent: paymentQuery
    .input(z.object({
      amount: z.number().optional(), // Legacy client hint; never trusted.
      currency: z.string().optional(), // Legacy client hint; never trusted.
      displayedQuoteId: z.string().uuid(),
      referenceNumber: z.string(),
      payerName: z.string().min(2).max(100),
      payerRelationship: z.enum(PAYER_RELATIONSHIPS),
      payerAuthorizationAccepted: z.literal(true),
      payerAuthorizationVersion: z.literal(PAYER_AUTHORIZATION_VERSION),
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
        const readiness = await getApplicationReadiness(app.id, ctx);
        if (readiness.status !== "READY") {
          auditLog("payment.readiness_rejected", "failure", "customer");
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: JSON.stringify({ code: "APPLICATION_INCOMPLETE", ...readiness }),
          });
        }

        const [leadApplicant] = await db.select({ fullName: applicants.fullName }).from(applicants)
          .where(eq(applicants.applicationId, app.id))
          .orderBy(asc(applicants.applicantIndex))
          .limit(1);
        if (!leadApplicant) throw new Error("Lead applicant identity is unavailable");
        validatePayerAuthorization({
          payerName: input.payerName,
          payerRelationship: input.payerRelationship,
          authorizationAccepted: input.payerAuthorizationAccepted,
          authorizationVersion: input.payerAuthorizationVersion,
          leadApplicantName: leadApplicant.fullName,
        });

        await withCheckoutLock(app.id, async connection => {
          const currentQuote = await refreshCheckoutQuote(connection, app.id);
          assertDisplayedQuote(currentQuote, input.displayedQuoteId);
          await reserveCheckoutPayment(connection, app.id, currentQuote.id, app.stripePaymentIntentId);
        });
        const issued = await withCheckoutLock(app.id, async connection => {
          const db = drizzle(connection);
          const [locked] = await db.select().from(applications).where(eq(applications.id, app.id)).limit(1);
          if (locked.paymentStatus === "paid") throw new TRPCError({ code: "CONFLICT", message: "Application is already paid. Refresh to see your confirmation." });
          const currentQuote = await refreshCheckoutQuote(connection, app.id);
          assertDisplayedQuote(currentQuote, input.displayedQuoteId);
          const priceSnapshot = currentQuote.quote;
          if (priceSnapshot.currency !== "USD") throw new Error("Stripe checkout requires a USD price snapshot");
          const serverAmountUsd = priceSnapshot.totalPrice;
          if (!Number.isFinite(serverAmountUsd) || serverAmountUsd <= 0) throw new Error("Application amount is invalid");
          const amountCents = Math.round(serverAmountUsd * 100);
          const attempt = await checkoutPaymentAttempt(connection, app.id);
          if (!attempt || attempt.quoteId !== currentQuote.id) throw new Error("Payment reservation is unavailable");
          const savedIntentId = locked.stripePaymentIntentId || attempt.intentId;
          assertSafeIntentRetry({ ...attempt, intentId: savedIntentId });
          const paymentIntent = savedIntentId
            ? await retrieveStripeTestIntent(savedIntentId)
            : await createStripeTestIntent({ amountCents, referenceNumber: app.referenceNumber, idempotencyKey: attempt.key });
          if (paymentIntent.amount !== amountCents || paymentIntent.currency !== "usd" || paymentIntent.metadata?.referenceNumber !== app.referenceNumber) {
            throw new TRPCError({ code: "CONFLICT", message: "The saved payment does not match this application. Contact support before trying again." });
          }
          if (!paymentIntent.client_secret) throw new Error("Stripe did not return a client secret");
          const [existingPayment] = await db.select({ id: payments.id }).from(payments)
            .where(eq(payments.stripePaymentIntentId, paymentIntent.id)).limit(1);
          let paymentId = existingPayment?.id;
          if (!paymentId) {
            const [created] = await db.insert(payments).values({ applicationId: app.id, stripePaymentIntentId: paymentIntent.id,
              amount: serverAmountUsd.toFixed(2), currency: "usd", status: "pending" }).$returningId();
            paymentId = created.id;
          }
          await db.update(applications).set({ stripePaymentIntentId: paymentIntent.id, stripeAmountUsd: serverAmountUsd.toFixed(2) })
            .where(eq(applications.id, app.id));
          await connection.execute("UPDATE checkout_payment_attempts SET stripe_payment_intent_id=? WHERE application_id=?", [paymentIntent.id, app.id]);
          return { paymentId, paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret, status: paymentIntent.status };
        });
        await recordPayerAuthorization({ applicationId: app.id, paymentId: issued.paymentId, payerName: input.payerName,
          payerRelationship: input.payerRelationship, authorizationAccepted: input.payerAuthorizationAccepted,
          authorizationVersion: input.payerAuthorizationVersion, leadApplicantName: leadApplicant.fullName });
        await recordTimelineEvent({ applicationId: app.id, paymentId: issued.paymentId, eventName: "PAYMENT_INTENT_CREATED",
          eventSource: "PAYMENT_API", actorType: "SYSTEM", actorReference: issued.paymentIntentId,
          resultingState: "pending", summary: "Stripe PaymentIntent created" });
        auditLog("payment.intent_create", "success", "customer");
        return { clientSecret: issued.clientSecret, paymentIntentId: issued.paymentIntentId, status: issued.status };
      } catch (err: unknown) {
        auditLog("payment.intent_create", "failure", "customer");
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: err });
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
      return { paymentStatus: app.paymentStatus, ...(await getApplicationReadiness(app.id, ctx)) };
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
