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

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

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
    const invoiceData = {
      invoiceNumber,
      referenceNumber: appRow.referenceNumber,
      createdAt: appRow.createdAt ? new Date(appRow.createdAt).toISOString() : new Date().toISOString(),
      customerName: appRow.contactEmail.split("@")[0] || "Customer",
      customerEmail: appRow.contactEmail,
      customerPhone: appRow.contactPhone,
      visaType: appRow.visaType,
      processingType: appRow.processingType,
      arrivalDate: appRow.arrivalDate || undefined,
      totalAmount: Number(appRow.totalAmount),
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
  } catch (err: any) {
    console.error(`[Invoice] Regeneration failed: ${err.message}`);
    return null;
  }
}

// VIEW route (inline) - NOT under /api/ to avoid catch-all conflict
app.get("/invoices/:invoiceNumber/view", async (c) => {
  const invoiceNumber = c.req.param("invoiceNumber");
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
  } catch (err: any) {
    console.error(`[Invoice] Read error: ${err.message}`);
    return c.json({ error: "Failed to read PDF" }, 500);
  }
});

// DOWNLOAD route (attachment) - NOT under /api/ to avoid catch-all conflict
app.get("/invoices/:invoiceNumber/download", async (c) => {
  const invoiceNumber = c.req.param("invoiceNumber");
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
  } catch (err: any) {
    console.error(`[Invoice] Read error: ${err.message}`);
    return c.json({ error: "Failed to read PDF" }, 500);
  }
});

// ===== tRPC ROUTES =====
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

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
