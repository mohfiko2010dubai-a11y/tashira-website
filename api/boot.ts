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
import { generateInvoicePDF } from "./lib/invoice-pdf";

const INVOICES_DIR = path.resolve(process.cwd(), "dist/public/invoices");
if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// ===== INVOICE PDF ROUTES (must be BEFORE /api/trpc and catch-all) =====
app.get("/api/invoices/:invoiceNumber/view", async (c) => {
  const invoiceNumber = c.req.param("invoiceNumber");

  try {
    const db = getDb();

    // Find by invoice_number
    const [appRow] = await db.select().from(applications)
      .where(eq(applications.invoiceNumber, invoiceNumber))
      .limit(1);

    if (!appRow) {
      // Try by reference_number fallback
      const [appByRef] = await db.select().from(applications)
        .where(eq(applications.referenceNumber, invoiceNumber.replace("INV-", "")))
        .limit(1);
      if (!appByRef) return c.json({ error: "Invoice not found" }, 404);
    }

    const row = appRow;
    const fileName = `${invoiceNumber}.pdf`;
    let absolutePath = path.join(INVOICES_DIR, fileName);

    // If file doesn't exist but invoice exists in DB, regenerate
    if (!fs.existsSync(absolutePath)) {
      if (!row.invoicePdfPath || !fs.existsSync(row.invoicePdfPath)) {
        // Auto-regenerate PDF
        const invoiceData = {
          invoiceNumber,
          referenceNumber: row.referenceNumber,
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
          customerName: row.contactEmail.split("@")[0] || "Customer",
          customerEmail: row.contactEmail,
          customerPhone: row.contactPhone,
          visaType: row.visaType,
          processingType: row.processingType,
          arrivalDate: row.arrivalDate || undefined,
          totalAmount: Number(row.totalAmount),
          stripePaymentIntentId: row.stripePaymentIntentId || undefined,
        };
        const doc = generateInvoicePDF(invoiceData);
        doc.save(absolutePath);

        // Update DB
        await db.update(applications).set({
          invoiceNumber,
          invoicePdfPath: absolutePath,
          invoicePdfUrl: `/invoices/${fileName}`,
        }).where(eq(applications.id, row.id));
      } else {
        absolutePath = row.invoicePdfPath;
      }
    }

    const pdfBuffer = fs.readFileSync(absolutePath);
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `inline; filename="${fileName}"`);
    return c.body(pdfBuffer);
  } catch (err: any) {
    console.error("[Invoice View Error]", err.message);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get("/api/invoices/:invoiceNumber/download", async (c) => {
  const invoiceNumber = c.req.param("invoiceNumber");

  try {
    const db = getDb();

    const [appRow] = await db.select().from(applications)
      .where(eq(applications.invoiceNumber, invoiceNumber))
      .limit(1);

    if (!appRow) {
      return c.json({ error: "Invoice not found" }, 404);
    }

    const fileName = `${invoiceNumber}.pdf`;
    let absolutePath = path.join(INVOICES_DIR, fileName);

    // Auto-regenerate if missing
    if (!fs.existsSync(absolutePath)) {
      if (appRow.invoicePdfPath && fs.existsSync(appRow.invoicePdfPath)) {
        absolutePath = appRow.invoicePdfPath;
      } else {
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
        doc.save(absolutePath);

        await db.update(applications).set({
          invoicePdfPath: absolutePath,
          invoicePdfUrl: `/invoices/${fileName}`,
        }).where(eq(applications.id, appRow.id));
      }
    }

    const pdfBuffer = fs.readFileSync(absolutePath);
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="${fileName}"`);
    c.header("Content-Length", String(pdfBuffer.length));
    return c.body(pdfBuffer);
  } catch (err: any) {
    console.error("[Invoice Download Error]", err.message);
    return c.json({ error: "Internal server error" }, 500);
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
c.app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

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
