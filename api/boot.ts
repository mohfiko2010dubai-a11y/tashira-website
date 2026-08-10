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
import { generateInvoicePDF, getStorageDir } from "./lib/invoice-pdf";
import { getErrorMessage } from "./lib/errors";
import { resolveStoragePath, verifyStorageSignedUrl } from "./lib/local-storage";
import { verifyStripeWebhook } from "./lib/stripe-webhook";
import { finalizeStripeTestPayment, recordStripeTestPaymentFailure } from "./lib/payment-finalization";
import { auditLog } from "./lib/audit-log";
import { verifyAdminSession } from "./lib/admin-session";
import { hasCustomerApplicationAccess } from "./lib/customer-session";
import { getStaffSession } from "./lib/staff-session";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 500 * 1024 * 1024 })); // 500MB total request
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

app.post("/api/stripe/webhook", async (c) => {
  try {
    const payload = await c.req.text();
    if (Buffer.byteLength(payload, "utf8") > 1024 * 1024) throw new Error("Stripe webhook payload is too large");
    const event = verifyStripeWebhook(payload, c.req.header("stripe-signature") || "");
    if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
      const referenceNumber = event.data.object.metadata.referenceNumber;
      if (!referenceNumber) throw new Error("Stripe event is missing the application reference");
      if (event.type === "payment_intent.succeeded") {
        await finalizeStripeTestPayment(referenceNumber, event.data.object.id);
      } else {
        await recordStripeTestPaymentFailure(referenceNumber, event.data.object.id);
      }
      auditLog("payment.confirm", "success", "system");
    }
    return c.json({ received: true });
  } catch (error: unknown) {
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
    const customerName = customerEmail.split("@")[0] || "Customer";
    
    const invoiceData = {
      invoiceNumber,
      referenceNumber: appRow.referenceNumber,
      createdAt: appRow.createdAt ? new Date(appRow.createdAt).toISOString() : new Date().toISOString(),
      customerName,
      customerEmail,
      customerPhone: appRow.contactPhone || "",
      visaType: appRow.visaType || "",
      processingType: appRow.processingType || "",
      arrivalDate: appRow.arrivalDate || undefined,
      totalAmount: Number(appRow.totalAmountUsd || appRow.stripeAmountUsd || 0),
      stripePaymentIntentId: appRow.stripePaymentIntentId || undefined,
    };

    const doc = generateInvoicePDF(invoiceData);
    const pdfOutput = doc.output("arraybuffer");
    fs.writeFileSync(absolutePath, Buffer.from(pdfOutput));

    // Update DB
    const db = getDb();
    await db.update(applications).set({
      invoiceNumber,
      invoicePdfPath: absolutePath,
      invoicePdfUrl: `/api/invoices/${invoiceNumber}/view`,
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
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
