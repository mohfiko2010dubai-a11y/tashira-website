import { z } from "zod";
import { adminQuery, applicationAccessQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { applications } from "@db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { getErrorMessage } from "./lib/errors";
import { assertApplicationReferenceAccess } from "./lib/application-access";

// Resolve absolute invoices directory
const INVOICES_DIR = path.resolve(process.cwd(), "dist/public/invoices");

// Ensure invoices directory exists
if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

export const invoiceRouter = createRouter({
  // Save invoice PDF (base64) to disk
  savePdf: applicationAccessQuery
    .input(z.object({
      invoiceNumber: z.string().regex(/^[A-Za-z0-9_-]+$/),
      referenceNumber: z.string().min(1),
      pdfBase64: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        assertApplicationReferenceAccess(ctx, input.referenceNumber);
        if (input.invoiceNumber !== `INV-${input.referenceNumber}`) throw new Error("Invoice does not match application");
        const pdfBuffer = Buffer.from(input.pdfBase64, "base64");
        if (pdfBuffer.length > 10 * 1024 * 1024 || pdfBuffer.subarray(0, 4).toString() !== "%PDF") {
          throw new Error("Invalid invoice PDF");
        }
        const fileName = `${input.invoiceNumber}.pdf`;
        const absolutePath = path.join(INVOICES_DIR, fileName);
        const publicUrl = `/invoices/${fileName}`;

        // Write PDF to disk
        fs.writeFileSync(absolutePath, pdfBuffer);

        // Update application with invoice info
        const db = getDb();
        await db.update(applications).set({
          invoiceNumber: input.invoiceNumber,
          invoicePdfPath: absolutePath,
          invoicePdfUrl: publicUrl,
        }).where(eq(applications.referenceNumber, input.referenceNumber));

        return {
          success: true,
          pdfUrl: publicUrl,
          absolutePath,
        };
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        console.error("[Invoice Save Error]", message);
        return { success: false, error: message };
      }
    }),

  // View invoice PDF (inline) - handled by Hono routes in boot.ts
  view: applicationAccessQuery
    .input(z.object({ invoiceNumber: z.string() }))
    .query(async () => {
      return { message: "Use /invoices/:invoiceNumber/view route" };
    }),

  // Download invoice PDF (attachment) - handled by Hono routes in boot.ts
  download: applicationAccessQuery
    .input(z.object({ invoiceNumber: z.string() }))
    .query(async () => {
      return { message: "Use /invoices/:invoiceNumber/download route" };
    }),

  // Regenerate invoice data for admin
  regenerate: adminQuery
    .input(z.object({
      referenceNumber: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDb();
        const [app] = await db.select().from(applications)
          .where(eq(applications.referenceNumber, input.referenceNumber))
          .limit(1);

        if (!app) {
          return { success: false, error: "Application not found" };
        }

        return {
          success: true,
          invoiceNumber: app.invoiceNumber || `INV-${input.referenceNumber}`,
          totalAmount: Number(app.totalAmountUsd || app.stripeAmountUsd || 0),
          customerEmail: app.contactEmail,
          customerPhone: app.contactPhone,
          visaType: app.visaType,
          processingType: app.processingType,
          referenceNumber: input.referenceNumber,
          stripePaymentIntentId: app.stripePaymentIntentId,
        };
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        console.error("[Invoice Regenerate Error]", message);
        return { success: false, error: message };
      }
    }),
});
