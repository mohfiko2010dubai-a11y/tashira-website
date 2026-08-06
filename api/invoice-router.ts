import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications } from "@db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

// Resolve absolute invoices directory
const INVOICES_DIR = path.resolve(process.cwd(), "dist/public/invoices");

// Ensure invoices directory exists
if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

export const invoiceRouter = createRouter({
  // Save invoice PDF (base64) to disk
  savePdf: publicQuery
    .input(z.object({
      invoiceNumber: z.string(),
      referenceNumber: z.string(),
      pdfBase64: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const pdfBuffer = Buffer.from(input.pdfBase64, "base64");
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
      } catch (err: any) {
        console.error("[Invoice Save Error]", err.message);
        return { success: false, error: err.message };
      }
    }),

  // View invoice PDF (inline) - handled by Hono routes in boot.ts
  view: publicQuery
    .input(z.object({ invoiceNumber: z.string() }))
    .query(async () => {
      return { message: "Use /invoices/:invoiceNumber/view route" };
    }),

  // Download invoice PDF (attachment) - handled by Hono routes in boot.ts
  download: publicQuery
    .input(z.object({ invoiceNumber: z.string() }))
    .query(async () => {
      return { message: "Use /invoices/:invoiceNumber/download route" };
    }),

  // Regenerate invoice data for admin
  regenerate: publicQuery
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
      } catch (err: any) {
        console.error("[Invoice Regenerate Error]", err.message);
        return { success: false, error: err.message };
      }
    }),
});
