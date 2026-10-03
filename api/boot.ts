import { readArchivedInvoice } from "./lib/invoice-archive";
import "../contracts/install-safe-console";
import { languagePath, languageRoute } from "../contracts/language-routes";
import { withSsrDeadline } from "./lib/ssr-deadline";
import { isHeldPublicPage, registerHeldPublicPages } from "./lib/held-public-pages";
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
import { applications } from "@db/schema";
import { eq } from "drizzle-orm";
import { getStorageDir } from "./lib/invoice-pdf";
import { getErrorMessage } from "./lib/errors";
import { internalFailure } from "./lib/public-error";
import { resolveStoragePath, verifyStorageSignedUrl } from "./lib/local-storage";
import { isSupportedStripeWebhookEvent, verifyStripeWebhook } from "./lib/stripe-webhook";
import { finalizeStripeTestPayment, recordStripeTestPaymentFailure } from "./lib/payment-finalization";
import { SupersededStripeEvent } from "./lib/payment-state";
import { auditLog } from "./lib/audit-log";
import { createAdminSessionCookie, verifyAdminSession } from "./lib/admin-session";
import { BrowserAuthRateLimiter, consumeStagingOwnerBrowserToken } from "./lib/staging-owner-browser-auth";
import { hasCustomerApplicationAccess } from "./lib/customer-session";
import { getStaffSession } from "./lib/staff-session";
import { hasTimelineEventReference, recordTimelineEvent } from "./lib/application-timeline";
import {
  claimStripeWebhookEvent,
  markStripeWebhookFailed,
  markStripeWebhookProcessed,
  type StripeWebhookClaim,
} from "./lib/stripe-webhook-idempotency";
import { verifyInvoiceDownloadToken } from "./lib/invoice-download-token";
import { publicAppOrigin } from "./lib/public-app-url";
import { validateStripeRuntimeConfig } from "./lib/stripe-runtime";
import {
  finalizeSecurityDepositPayment,
  getSecurityDepositWebhookContext,
  recordSecurityDepositPaymentFailure,
} from "./lib/security-deposit-finalization";

const app = new Hono<{ Bindings: HttpBindings }>();
const stagingOwnerAuthLimiter = new BrowserAuthRateLimiter();
validateStripeRuntimeConfig();

app.use(bodyLimit({ maxSize: 500 * 1024 * 1024 })); // 500MB total request
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

app.get("/staging-owner-auth/:token", (c) => {
  const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const identity = forwardedFor || c.req.header("x-real-ip") || "unknown";
  if (!stagingOwnerAuthLimiter.allow(identity)) {
    auditLog("staging-owner.login", "failure", "anonymous");
    return c.json({ error: "Unauthorized" }, 401);
  }
  const result = consumeStagingOwnerBrowserToken(c.req.param("token"));
  if (result !== "CONSUMED") {
    auditLog("staging-owner.login", "failure", "anonymous");
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.header("set-cookie", createAdminSessionCookie(c.req.raw.headers));
  auditLog("staging-owner.login", "success", "admin");
  return c.redirect("/admin");
});

app.post("/api/stripe/webhook", async (c) => {
  let claimedEvent: StripeWebhookClaim | null = null;
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
      if (claim.status !== "process") {
        return claim.status === "duplicate" ? c.json({ received: true, duplicate: true })
          : c.json({ error: "Event is already processing. Retry delivery." }, 503);
      }
      claimedEvent = claim;
      const depositRequestId = event.data.object.metadata.securityDepositRequestId;
      const referenceNumber = event.data.object.metadata.referenceNumber;
      const context = depositRequestId
        ? await getSecurityDepositWebhookContext(depositRequestId)
        : referenceNumber
          ? await getDb().select({ applicationId: applications.id, referenceNumber: applications.referenceNumber })
            .from(applications).where(eq(applications.referenceNumber, referenceNumber)).limit(1).then(([row]) => row)
          : null;
      if (!context) throw new Error("Stripe event is missing a recognized payment owner");
      const application = { id: context.applicationId };
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
        if (depositRequestId) {
          await finalizeSecurityDepositPayment(event.data.object.id, depositRequestId);
        } else {
          await finalizeStripeTestPayment(context.referenceNumber, event.data.object.id, {
            actorType: "STRIPE",
            eventSource: "STRIPE_WEBHOOK",
            eventCreated: event.created,
          });
        }
      } else {
        if (depositRequestId) await recordSecurityDepositPaymentFailure(event.data.object.id, depositRequestId);
        else await recordStripeTestPaymentFailure(context.referenceNumber, event.data.object.id, event.created);
      }
      const completedClaim = claimedEvent;
      claimedEvent = null;
      await markStripeWebhookProcessed(completedClaim);
      auditLog("payment.confirm", "success", "system");
    }
    return c.json({ received: true });
  } catch (error: unknown) {
    if (claimedEvent) {
      if (error instanceof SupersededStripeEvent) {
        await markStripeWebhookProcessed(claimedEvent);
        return c.json({ received: true, ignored: true });
      }
      try {
        await markStripeWebhookFailed(claimedEvent);
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

// Serve issued bytes only. A missing archive is an operational error, never a new invoice.
async function getOrGeneratePdf(invoiceNumber: string) {
  const fileName = `${invoiceNumber}.pdf`;
  const archived = await readArchivedInvoice(invoiceNumber);
  if (archived) return { bytes: archived, fileName };
  const appRow = await findApplicationByInvoice(invoiceNumber);
  if (!appRow || appRow.paymentStatus !== "paid") return null;
  const candidates = [appRow.invoicePdfPath, path.join(INVOICES_DIR, fileName)];
  for (const candidate of candidates) {
    if (candidate && !candidate.startsWith("archive:") && fs.existsSync(candidate)) return { bytes: fs.readFileSync(candidate), fileName };
  }
  return null;
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
  const pdfBuffer = result.bytes;
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="${result.fileName}"`);
  c.header("Content-Length", String(pdfBuffer.length));
  c.header("Cache-Control", "private, no-store");
  return c.body(new Uint8Array(pdfBuffer));
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
    const pdfBuffer = result.bytes;
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `inline; filename="${result.fileName}"`);
    console.log(`[Invoice] Serving VIEW: archived PDF (${pdfBuffer.length} bytes)`);
    return c.body(new Uint8Array(pdfBuffer));
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
    const pdfBuffer = result.bytes;
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="${result.fileName}"`);
    c.header("Content-Length", String(pdfBuffer.length));
    console.log(`[Invoice] Serving DOWNLOAD: archived PDF (${pdfBuffer.length} bytes)`);
    return c.body(new Uint8Array(pdfBuffer));
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
    return c.json(internalFailure(err), 500);
  }
});

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", time: new Date().toISOString() }));

// ===== Dynamic XML sitemap (published CMS content + core static routes) =====
app.get("/sitemap.xml", async (c) => {
  if (process.env.PUBLIC_APP_URL?.replace(/\/$/, "") === "https://staging.tashiraev.com") {
    c.header("Cache-Control", "private, no-store");
    return c.text("Not Found", 404);
  }
  const base = publicAppOrigin().replace(/\/$/, "");
  const staticPaths = ["/", "/visa-prices", "/how-to-apply", "/apply", "/visa-pre-check", "/contact", "/terms", "/privacy", "/refund", "/cookies"];
  let contentRows: { slug: string; language: string; updatedAt: Date }[] = [];
  try {
    const db = getDb();
    const { contentItems } = await import("@db/schema");
    contentRows = await db.select({
      slug: contentItems.slug, language: contentItems.language, updatedAt: contentItems.updatedAt,
    }).from(contentItems).where(eq(contentItems.status, "PUBLISHED"));
  } catch {
    contentRows = [];
  }
  const urls = [
    ...staticPaths.filter(p => !isHeldPublicPage(p)).map((p) => `  <url><loc>${base}${p}</loc><changefreq>weekly</changefreq></url>`),
    ...contentRows.filter(row => !isHeldPublicPage(`/${row.slug}`)).map((row) => `  <url><loc>${base}/${row.slug}</loc><lastmod>${new Date(row.updatedAt).toISOString().slice(0, 10)}</lastmod><changefreq>weekly</changefreq></url>`),
  ];
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
});

// Hold unpublished landing pages before CMS redirects and the SPA fallback.
registerHeldPublicPages(app);

// ===== CMS-managed safe same-site redirects =====
app.use("*", async (c, next) => {
  const localeRoute = languageRoute(c.req.path);
  const pathOnly = localeRoute.pathname;
  if (pathOnly.startsWith("/api/") || pathOnly.startsWith("/storage/")) return next();
  const lookupStarted = performance.now();
  try {
    const db = getDb();
    const { contentRedirects } = await import("@db/schema");
    const [redirect] = await withSsrDeadline(() => db.select().from(contentRedirects)
      .where(eq(contentRedirects.fromPath, pathOnly)).limit(1), { stage: "data" });
    if (redirect && redirect.isActive === 1 && redirect.toPath.startsWith("/") && !redirect.toPath.startsWith("//")) {
      return c.redirect(localeRoute.prefixed ? languagePath(redirect.toPath, localeRoute.language) : redirect.toPath, redirect.statusCode === 302 ? 302 : 301);
    }
  } catch {
    // Redirect table may not exist yet — fall through to the SPA.
  } finally {
    if (!pathOnly.startsWith("/assets/")) console.info(JSON.stringify({ event: "ssr_redirect_lookup", language: localeRoute.language, elapsedMs: performance.now() - lookupStarted }));
  }
  return next();
});

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
