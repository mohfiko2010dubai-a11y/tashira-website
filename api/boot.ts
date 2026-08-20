import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import fs from "fs";
import path from "path";
import { getDb } from "./queries/connection";
import { applications, payments } from "@db/schema";
import { desc, eq } from "drizzle-orm";
import { generateInvoicePDF, getStorageDir } from "./lib/invoice-pdf";
import { getErrorMessage } from "./lib/errors";
import { resolveStoragePath, verifyStorageSignedUrl } from "./lib/local-storage";
import { isSupportedStripeWebhookEvent, verifyStripeWebhook } from "./lib/stripe-webhook";
import { finalizeStripeTestPayment, recordStripeTestPaymentFailure } from "./lib/payment-finalization";
import { auditLog } from "./lib/audit-log";
import { verifyAdminSession } from "./lib/admin-session";
import { hasCustomerApplicationAccess } from "./lib/customer-session";
import { getStaffSession } from "./lib/staff-session";
import { hasTimelineEventReference, recordTimelineEvent } from "./lib/application-timeline";
import {
  claimStripeWebhookEvent,
  markStripeWebhookFailed,
  markStripeWebhookProcessed,
} from "./lib/stripe-webhook-idempotency";
import { verifyInvoiceDownloadToken } from "./lib/invoice-download-token";
import { getCanonicalInvoiceCustomerIdentity } from "./lib/invoice-customer-name";
import { getApplicationPriceSnapshot } from "./lib/pricing-engine";
import { getPayerEvidence } from "./lib/payer-authorization";
import { retrieveStripeTestCardSummary } from "./lib/stripe";
import { validateStripeRuntimeConfig } from "./lib/stripe-runtime";

const app = new Hono<{ Bindings: HttpBindings }>();
validateStripeRuntimeConfig();

app.use(bodyLimit({ maxSize: 500 * 1024 * 1024 })); // 500MB total request
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

app.post("/api/stripe/webhook", async (c) => {
  let claimedEventId: string | null = null;
  try {
    const payload = await c.req.text();
    if (Buffer.byteLength(payload, "utf8") > 1024 * 1024) throw new Error("Stripe webhook payload is too large");
    const event = verifyStripeWebhook(payload, c.req.header("stripe-signature") || "");
    if (isSupportedStripeWebhookEvent(event.type)) {
      const claim = await claimStripeWebhookEvent({
        eventId: event.id,
        eventType: event.type,
        paymentIntentId: event.data.object.id,
      });
      if (claim === "duplicate") return c.json({ received: true, duplicate: true });
      claimedEventId = event.id;
      const referenceNumber = event.data.object.metadata.referenceNumber;
      if (!referenceNumber) throw new Error("Stripe event is missing the application reference");
      const [application] = await getDb().select({ id: applications.id }).from(applications)
        .where(eq(applications.referenceNumber, referenceNumber)).limit(1);
      if (!application) throw new Error("Application not found");
      if (!await hasTimelineEventReference(application.id, "WEBHOOK_RECEIVED", event.id)) {
        await recordTimelineEvent({
          applicationId: application.id,
          eventName: "WEBHOOK_RECEIVED",
          eventSource: "STRIPE_WEBHOOK",
          actorType: "STRIPE",
          actorReference: event.id,
          summary: "Stripe webhook received",
        });
      }
      if (!await hasTimelineEventReference(application.id, "WEBHOOK_VERIFIED", event.id)) {
        await recordTimelineEvent({
          applicationId: application.id,
          eventName: "WEBHOOK_VERIFIED",
          eventSource: "STRIPE_WEBHOOK",
          actorType: "SYSTEM",
          actorReference: event.id,
          summary: "Stripe webhook signature verified",
        });
      }
      if (event.type === "payment_intent.requires_action") {
        await recordTimelineEvent({
          applicationId: application.id,
          eventName: "THREE_DS_REQUIRED",
          eventSource: "STRIPE_WEBHOOK",
          actorType: "STRIPE",
          actorReference: event.data.object.id,
          resultingState: "requires_action",
          summary: "Additional customer authentication required",
        });
      } else if (event.type === "payment_intent.succeeded") {
        await finalizeStripeTestPayment(referenceNumber, event.data.object.id, {
          actorType: "STRIPE",
          eventSource: "STRIPE_WEBHOOK",
        });
      } else {
        await recordStripeTestPaymentFailure(referenceNumber, event.data.object.id);
      }
      await markStripeWebhookProcessed(event.id);
      auditLog("payment.confirm", "success", "system");
    }
    return c.json({ received: true });
  } catch (error: unknown) {
    if (claimedEventId) {
      try {
        await markStripeWebhookFailed(claimedEventId);
      } catch (markError: unknown) {
        console.error("[Stripe Webhook State]", getErrorMessage(markError));
      }
    }
    auditLog("payment.confirm", "failure", "system");
    console.error("[Stripe Webhook]", getErrorMessage(error));
    return c.json({ error: "Invalid webhook" }, 400);
  }
});

// ===== INVOICE PDF ROUTES (must be BEFORE /api/trpc and catch-all) =====

const INVOICES_DIR = getStorageDir();

// Helper: find application by invoice number (with fallback to reference)
async function findApplicationByInvoice(invoiceNumber: string) {
  const db = getDb();

  // 1. Try by invoice_number
  const [byInvoice] = await db.select().from(applications)
    .where(eq(applications.invoiceNumber, invoiceNumber))
    .limit(1);

  if (byInvoice) {
    console.log(`[Invoice] Found by invoice_number: ${invoiceNumber}`);
    return byInvoice;
  }

  // 2. Fallback: try by reference_number (strip INV- prefix)
  const refNumber = invoiceNumber.replace(/^INV-/, "");
  const [byRef] = await db.select().from(applications)
    .where(eq(applications.referenceNumber, refNumber))
    .limit(1);

  if (byRef) {
    console.log(`[Invoice] Found by reference_number: ${refNumber}`);
    return byRef;
  }

  console.log(`[Invoice] Not found: ${invoiceNumber}`);
  return null;
}

// Helper: get or regenerate PDF
async function getOrGeneratePdf(invoiceNumber: string) {
  const fileName = `${invoiceNumber}.pdf`;
  const absolutePath = path.join(INVOICES_DIR, fileName);

  console.log(`[Invoice] Request: ${invoiceNumber}`);
  console.log(`[Invoice] Checking: ${absolutePath}`);

  // 1. Check if file already exists
  if (fs.existsSync(absolutePath)) {
    console.log(`[Invoice] File exists: ${absolutePath} (${fs.statSync(absolutePath).size} bytes)`);
    return { absolutePath, fileName, regenerated: false };
  }

  console.log(`[Invoice] File missing, looking up DB...`);

  // 2. Find application
  const appRow = await findApplicationByInvoice(invoiceNumber);
  if (!appRow) {
    console.log(`[Invoice] Application not found for: ${invoiceNumber}`);
    return null;
  }

  // 3. Check DB stored path
  const dbPath = appRow.invoicePdfPath;
  if (dbPath && typeof dbPath === 'string' && dbPath.length > 0) {
    if (fs.existsSync(dbPath)) {
      console.log(`[Invoice] Found existing PDF at DB path: ${dbPath}`);
      return { absolutePath: dbPath, fileName, regenerated: false };
    }
    console.log(`[Invoice] DB path exists but file missing: ${dbPath}`);
  } else {
    console.log(`[Invoice] No invoicePdfPath in DB for: ${invoiceNumber}`);
  }

  // 4. Auto-regenerate
  console.log(`[Invoice] Auto-regenerating PDF for: ${invoiceNumber}`);
  try {
    const customerEmail = appRow.contactEmail || "customer@example.com";
    const [customerIdentity, priceSnapshot, paymentRows] = await Promise.all([
      getCanonicalInvoiceCustomerIdentity(appRow.id),
      getApplicationPriceSnapshot(appRow.id),
      getDb().select().from(payments).where(eq(payments.applicationId, appRow.id)).orderBy(desc(payments.createdAt)).limit(1),
    ]);
    const payment = paymentRows[0];
    if (!payment) throw new Error("Verified payment is unavailable for invoice generation");
    const [payerEvidence, cardSummary] = await Promise.all([
      getPayerEvidence(appRow.id, payment.id),
      retrieveStripeTestCardSummary(payment.stripePaymentIntentId).catch(() => null),
    ]);
    if (!payerEvidence) throw new Error("Verified payer authorization evidence is unavailable for invoice generation");
    
    const invoiceData = {
      invoiceNumber,
      referenceNumber: appRow.referenceNumber,
      createdAt: appRow.createdAt ? new Date(appRow.createdAt).toISOString() : new Date().toISOString(),
      customerName: customerIdentity.fullName,
      customerEmail,
      customerPhone: appRow.contactPhone || "",
      nationality: customerIdentity.nationality,
      passportNumber: customerIdentity.passportNumber,
      passportExpiry: customerIdentity.passportExpiry,
      visaType: appRow.visaType || "",
      processingType: appRow.processingType || "",
      arrivalDate: appRow.arrivalDate || undefined,
      applicantCount: priceSnapshot.applicantCount,
      unitPriceInBaseCurrency: Number(priceSnapshot.unitPrice) * Number(priceSnapshot.exchangeRateToBase),
      baseCurrency: priceSnapshot.baseCurrency.toUpperCase(),
      exchangeRateToBase: Number(priceSnapshot.exchangeRateToBase),
      totalAmount: Number(appRow.totalAmountUsd || appRow.stripeAmountUsd || 0),
      currency: priceSnapshot.currency.toUpperCase(),
      stripePaymentIntentId: appRow.stripePaymentIntentId || undefined,
      payerName: payerEvidence.payerName,
      payerRelationship: payerEvidence.relationship,
      cardBrand: cardSummary?.brand,
      cardLast4: cardSummary?.last4,
    };

    const doc = generateInvoicePDF(invoiceData);
    const pdfOutput = doc.output("arraybuffer");
    fs.writeFileSync(absolutePath, Buffer.from(pdfOutput));

    // Update DB
    const db = getDb();
    await db.update(applications).set({
      invoiceNumber,
      invoicePdfPath: absolutePath,
      invoicePdfUrl: `/invoices/${invoiceNumber}/view`,
    }).where(eq(applications.id, appRow.id));

    console.log(`[Invoice] Regenerated and saved: ${absolutePath} (${fs.statSync(absolutePath).size} bytes)`);
    return { absolutePath, fileName, regenerated: true };
  } catch (err: unknown) {
    console.error(`[Invoice] Regeneration failed: ${getErrorMessage(err)}`);
    return null;
  }
}

function canAccessInvoice(headers: Headers, referenceNumber: string) {
  if (verifyAdminSession(headers) || hasCustomerApplicationAccess(headers, referenceNumber)) return true;
  const staffToken = headers.get("x-staff-token") || "";
  return Boolean(staffToken && getStaffSession(staffToken));
}

async function authorizeInvoiceRequest(invoiceNumber: string, headers: Headers) {
  if (!/^[A-Za-z0-9_-]+$/.test(invoiceNumber)) return { status: 400 as const, application: null };
  const application = await findApplicationByInvoice(invoiceNumber);
  if (!application) return { status: 404 as const, application: null };
  if (!canAccessInvoice(headers, application.referenceNumber)) return { status: 401 as const, application: null };
  return { status: 200 as const, application };
}

app.get("/invoice-download/:invoiceNumber", async (c) => {
  const invoiceNumber = c.req.param("invoiceNumber");
  if (!/^[A-Za-z0-9_-]+$/.test(invoiceNumber)) return c.json({ error: "Unauthorized" }, 401);
  const application = await findApplicationByInvoice(invoiceNumber);
  if (!application || !verifyInvoiceDownloadToken({
    invoiceNumber,
    referenceNumber: application.referenceNumber,
    expiresValue: c.req.query("expires") || "",
    providedSignature: c.req.query("signature") || "",
  })) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const result = await getOrGeneratePdf(invoiceNumber);
  if (!result) return c.json({ error: "Invoice not found" }, 404);
  await recordTimelineEvent({
    applicationId: application.id,
    eventName: "INVOICE_DOWNLOADED",
    eventSource: "INVOICE_EMAIL_LINK",
    actorType: "CUSTOMER",
    actorReference: invoiceNumber,
    resultingState: "downloaded",
    summary: "Invoice downloaded with short-lived email capability",
  });
  const pdfBuffer = fs.readFileSync(result.absolutePath);
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="${result.fileName}"`);
  c.header("Content-Length", String(pdfBuffer.length));
  c.header("Cache-Control", "private, no-store");
  return c.body(pdfBuffer);
});

// VIEW route (inline) - NOT under /api/ to avoid catch-all conflict
app.get("/invoices/:invoiceNumber/view", async (c) => {
  const invoiceNumber = c.req.param("invoiceNumber");
  const access = await authorizeInvoiceRequest(invoiceNumber, c.req.raw.headers);
  if (!access.application) return c.json({ error: access.status === 400 ? "Invalid invoice" : access.status === 404 ? "Invoice not found" : "Unauthorized" }, access.status);
  const result = await getOrGeneratePdf(invoiceNumber);

  if (!result) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  try {
    const pdfBuffer = fs.readFileSync(result.absolutePath);
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `inline; filename="${result.fileName}"`);
    console.log(`[Invoice] Serving VIEW: ${result.absolutePath} (${pdfBuffer.length} bytes)`);
    return c.body(pdfBuffer);
  } catch (err: unknown) {
    console.error(`[Invoice] Read error: ${getErrorMessage(err)}`);
    return c.json({ error: "Failed to read PDF" }, 500);
  }
});

// DOWNLOAD route (attachment) - NOT under /api/ to avoid catch-all conflict
app.get("/invoices/:invoiceNumber/download", async (c) => {
  const invoiceNumber = c.req.param("invoiceNumber");
  const access = await authorizeInvoiceRequest(invoiceNumber, c.req.raw.headers);
  if (!access.application) return c.json({ error: access.status === 400 ? "Invalid invoice" : access.status === 404 ? "Invoice not found" : "Unauthorized" }, access.status);
  const result = await getOrGeneratePdf(invoiceNumber);

  if (!result) {
    return c.json({ error: "Invoice not found" }, 404);
  }

  try {
    const pdfBuffer = fs.readFileSync(result.absolutePath);
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="${result.fileName}"`);
    c.header("Content-Length", String(pdfBuffer.length));
    console.log(`[Invoice] Serving DOWNLOAD: ${result.absolutePath} (${pdfBuffer.length} bytes)`);
    return c.body(pdfBuffer);
  } catch (err: unknown) {
    console.error(`[Invoice] Read error: ${getErrorMessage(err)}`);
    return c.json({ error: "Failed to read PDF" }, 500);
  }
});

// ===== LOCAL FILE STORAGE ROUTES =====
app.get("/storage/*", async (c) => {
  const filePath = c.req.path.replace("/storage/", "");
  if (!verifyStorageSignedUrl(filePath, c.req.query("expires") || "", c.req.query("signature") || "")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  let fullPath: string;
  try {
    fullPath = resolveStoragePath(filePath);
  } catch {
    return c.json({ error: "Invalid path" }, 400);
  }

  if (!fs.existsSync(fullPath)) {
    return c.json({ error: "File not found" }, 404);
  }

  const ext = path.extname(fullPath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";

  const fileBuffer = fs.readFileSync(fullPath);
  c.header("Content-Type", contentType);
  c.header("Cache-Control", "public, max-age=3600");
  return c.body(fileBuffer);
});

// ===== tRPC ROUTES =====
app.use("/api/trpc/*", async (c) => {
  try {
    return await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext,
    });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error("[tRPC] Unhandled error in fetchRequestHandler:", message);
    return c.json(
      {
        error: "Internal Server Error",
        message: env.isProduction ? "Something went wrong" : message,
      },
      500,
    );
  }
});

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", time: new Date().toISOString() }));

// Catch-all
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  const hostname = process.env.HOST || "0.0.0.0";
  serve({ fetch: app.fetch, port, hostname }, () => {
    console.log(`Server listening on ${hostname}:${port}`);
  });
}
