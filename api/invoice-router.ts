import { z } from "zod";
import { adminQuery, applicationAccessQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { applications } from "@db/schema";
import { eq } from "drizzle-orm";
import { getErrorMessage } from "./lib/errors";
import { internalFailure } from "./lib/public-error";
import { assertApplicationReferenceAccess } from "./lib/application-access";

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
        throw new Error("Issued invoices cannot be replaced. Request a credit note and a new invoice through the approved finance workflow.");
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        console.error("[Invoice Save Error]", message);
        return internalFailure(err);
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
        return internalFailure(err);
      }
    }),
});
