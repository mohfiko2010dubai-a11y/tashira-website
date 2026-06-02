import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications } from "@db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

const INVOICES_DIR = path.resolve(process.cwd(), "public/invoices");

// Ensure invoices directory exists
if (!fs.existsSync(INVOICES_DIR)) {
  fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

export const invoiceRouter = createRouter({
  // Save invoice PDF (base64)
  savePdf: publicQuery
    .input(z.object({
      invoiceNumber: z.string(),
      referenceNumber: z.string(),
      pdfBase64: z.string(), // base64 encoded PDF
    }))
    .mutation(async ({ input }) => {
      try {
        const pdfBuffer = Buffer.from(input.pdfBase64, "base64");
        const fileName = `${input.invoiceNumber}.pdf`;
        const filePath = path.join(INVOICES_DIR, fileName);

        // Write PDF to disk
        fs.writeFileSync(filePath, pdfBuffer);

        // Update application with invoice info
        const db = getDb();
        await db.update(applications).set({
          invoiceNumber: input.invoiceNumber,
          invoicePdfPath: `/invoices/${fileName}`,
          invoicePdfUrl: `/invoices/${fileName}`,
        }).where(eq(applications.referenceNumber, input.referenceNumber));

        return {
          success: true,
          pdfUrl: `/invoices/${fileName}`,
        };
      } catch (err: any) {
        console.error("[Invoice Save Error]", err.message);
        return { success: false, error: err.message };
      }
    }),

  // Regenerate invoice for admin
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

        // Return data needed to regenerate invoice
        return {
          success: true,
          invoiceNumber: app.invoiceNumber || `INV-${input.referenceNumber}`,
          totalAmount: Number(app.totalAmount),
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
