import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, documents } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getErrorMessage } from "./lib/errors";
import { storageUpload } from "./lib/local-storage";
import { sanitizeDocumentFileName, validateDocumentFile } from "./lib/document-upload";

type ResidenceType = "non-gcc" | "gcc-resident" | "non-gcc-accompany" | "gcc-accompany";
type ProcessingType = "regular" | "express";

function mapResidenceType(status: string): ResidenceType {
  const s = status.toLowerCase();
  if (s.includes("gcc citizen with")) return "gcc-accompany";
  if (s.includes("accompanying gcc")) return "non-gcc-accompany";
  if (s.startsWith("gcc")) return "gcc-resident";
  return "non-gcc";
}

function mapProcessingType(processingType?: string): ProcessingType {
  return processingType?.toLowerCase() === "express" ? "express" : "regular";
}

export const wizardRouter = createRouter({
  // Start a new submitted application (called on first step)
  startApplication: publicQuery
    .input(z.object({
      referenceNumber: z.string(),
      whoTraveling: z.string().optional(),
      residenceStatus: z.string().optional(),
      visaType: z.string().optional(),
      processingType: z.string().optional(),
      fullName: z.string().optional(),
      nationality: z.string().optional(),
      passportNumber: z.string().optional(),
      passportExpiry: z.string().optional(),
      profession: z.string().optional(),
      countryFrom: z.string().optional(),
      arrivalDate: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      applicantCount: z.number().min(1).default(1),
      totalAmount: z.number().min(0).default(0),
      chatSessionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log("[Wizard] Starting application:", input.referenceNumber);
      try {
        const db = getDb();
        const exchangeRate = 3.6725;
        const totalAed = input.totalAmount * exchangeRate;

        await db.insert(applications).values({
          referenceNumber: input.referenceNumber,
          baseType: (input.applicantCount ?? 1) > 1 ? "family" : "single",
          residenceType: input.residenceStatus ? mapResidenceType(input.residenceStatus) : "non-gcc",
          visaType: input.visaType || "",
          processingType: mapProcessingType(input.processingType),
          contactEmail: input.email || "",
          contactPhone: input.phone || "",
          totalAmountAed: String(totalAed),
          totalAmountUsd: String(input.totalAmount ?? 0),
          exchangeRate: String(exchangeRate),
          status: "submitted",
          paymentStatus: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const [inserted] = await db.select({ id: applications.id })
          .from(applications)
          .where(eq(applications.referenceNumber, input.referenceNumber))
          .limit(1);

        return { success: true, referenceNumber: input.referenceNumber, applicationId: inserted?.id };
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Wizard] Failed to start application:", message);
        throw new Error(`Failed to start application: ${message}`);
      }
    }),

  // Update an existing submitted application (called after each step)
  updateApplication: publicQuery
    .input(z.object({
      referenceNumber: z.string(),
      whoTraveling: z.string().optional(),
      residenceStatus: z.string().optional(),
      visaType: z.string().optional(),
      processingType: z.string().optional(),
      fullName: z.string().optional(),
      nationality: z.string().optional(),
      passportNumber: z.string().optional(),
      passportExpiry: z.string().optional(),
      profession: z.string().optional(),
      countryFrom: z.string().optional(),
      arrivalDate: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      applicantCount: z.number().min(1).optional(),
      totalAmount: z.number().min(0).optional(),
      lastStep: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDb();

        const updateData: Partial<typeof applications.$inferInsert> = {
          updatedAt: new Date(),
        };

        if (input.whoTraveling !== undefined) updateData.baseType = input.applicantCount && input.applicantCount > 1 ? "family" : "single";
        if (input.residenceStatus !== undefined) updateData.residenceType = mapResidenceType(input.residenceStatus);
        if (input.visaType !== undefined) updateData.visaType = input.visaType;
        if (input.processingType !== undefined) updateData.processingType = mapProcessingType(input.processingType);
        if (input.arrivalDate !== undefined) updateData.arrivalDate = input.arrivalDate;
        if (input.email !== undefined) updateData.contactEmail = input.email;
        if (input.phone !== undefined) updateData.contactPhone = input.phone;
        if (input.totalAmount !== undefined) {
          updateData.totalAmountUsd = String(input.totalAmount);
          updateData.totalAmountAed = String(input.totalAmount * 3.6725);
        }

        await db.update(applications)
          .set(updateData)
          .where(eq(applications.referenceNumber, input.referenceNumber));

        const [updated] = await db.select({ id: applications.id })
          .from(applications)
          .where(eq(applications.referenceNumber, input.referenceNumber))
          .limit(1);

        return { success: true, referenceNumber: input.referenceNumber, applicationId: updated?.id };
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Wizard] Failed to update application:", message);
        throw new Error(`Failed to update application: ${message}`);
      }
    }),

  // Submit complete application (called on CONFIRM)
  submitApplication: publicQuery
    .input(z.object({
      referenceNumber: z.string(),
      fullName: z.string().min(1),
      nationality: z.string().min(1),
      passportNumber: z.string().min(1),
      passportExpiry: z.string(),
      profession: z.string().min(1),
      countryFrom: z.string().min(1),
      arrivalDate: z.string(),
      email: z.string().email(),
      phone: z.string().min(1),
      visaType: z.string().min(1),
      processingType: z.string().min(1),
      residenceStatus: z.string().min(1),
      whoTraveling: z.string().min(1),
      applicantCount: z.number().min(1),
      totalAmount: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      console.log("[Wizard] Submitting application:", input.referenceNumber);
      try {
        const db = getDb();
        const exchangeRate = 3.6725;
        const totalAed = input.totalAmount * exchangeRate;

        await db.update(applications)
          .set({
            baseType: input.applicantCount > 1 ? "family" : "single",
            residenceType: mapResidenceType(input.residenceStatus),
            visaType: input.visaType,
            processingType: mapProcessingType(input.processingType),
            arrivalDate: input.arrivalDate,
            contactEmail: input.email,
            contactPhone: input.phone,
            totalAmountAed: String(totalAed),
            totalAmountUsd: String(input.totalAmount),
            exchangeRate: String(exchangeRate),
            status: "documents_pending",
            paymentStatus: "pending",
            updatedAt: new Date(),
          })
          .where(eq(applications.referenceNumber, input.referenceNumber));

        const [updated] = await db.select({ id: applications.id })
          .from(applications)
          .where(eq(applications.referenceNumber, input.referenceNumber))
          .limit(1);

        return { success: true, referenceNumber: input.referenceNumber, applicationId: updated?.id };
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Wizard] Failed to submit application:", message);
        throw new Error(`Failed to save application: ${message}`);
      }
    }),

  // List submitted applications (for Chat Inbox tracking)
  listIncomplete: publicQuery
    .query(async () => {
      try {
        const db = getDb();
        const results = await db.select()
          .from(applications)
          .where(eq(applications.status, "submitted"))
          .orderBy(desc(applications.createdAt));

        return results;
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Wizard] Failed to list submitted:", message);
        throw new Error(`Failed to list submitted applications: ${message}`);
      }
    }),

  // List all applications with payment pending (submitted + documents_pending)
  listPending: publicQuery
    .query(async () => {
      try {
        const db = getDb();
        const results = await db.select()
          .from(applications)
          .where(
            sql`${applications.status} IN ('submitted', 'documents_pending') OR ${applications.paymentStatus} = 'pending'`
          )
          .orderBy(desc(applications.createdAt));

        return results;
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Wizard] Failed to list pending:", message);
        throw new Error(`Failed to list pending applications: ${message}`);
      }
    }),

  // Get single application by reference number
  getByReference: publicQuery
    .input(z.object({ referenceNumber: z.string() }))
    .query(async ({ input }) => {
      try {
        const db = getDb();
        const [app] = await db.select()
          .from(applications)
          .where(eq(applications.referenceNumber, input.referenceNumber))
          .limit(1);
        return app || null;
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Wizard] Failed to get application:", message);
        throw new Error(`Failed to get application: ${message}`);
      }
    }),

  // Upload documents for a wizard application
  uploadDocuments: publicQuery
    .input(z.object({
      applicationId: z.number().positive(),
      documentType: z.enum(["passport", "photo", "national_id", "supporting", "visa", "invoice", "gcc_residence", "sponsor_id"]),
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
      fileSize: z.number().positive(),
      base64Data: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDb();

        // Decode base64
        const fileBuffer = Buffer.from(input.base64Data, "base64");
        const validationError = validateDocumentFile(input.mimeType, input.fileSize, fileBuffer.length);
        if (validationError) throw new Error(validationError);

        // Create stored filename
        const timestamp = Date.now();
        const storedName = `${timestamp}-${sanitizeDocumentFileName(input.fileName)}`;
        const storagePath = `applications/${input.applicationId}/${input.documentType}/${storedName}`;

        // Persist at the same canonical path recorded in MySQL and served by /storage/*.
        await storageUpload(storagePath, fileBuffer, input.mimeType);

        // Insert into documents table
        await db.insert(documents).values({
          applicationId: input.applicationId,
          documentType: input.documentType,
          originalFileName: input.fileName,
          storedFileName: storedName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          storagePath: storagePath,
          uploadStatus: "uploaded",
          uploadedBy: "chatbot-wizard",
        });

        return { success: true, storagePath, storedFileName: storedName };
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Wizard] Failed to upload document:", message);
        throw new Error(`Failed to upload document: ${message}`);
      }
    }),
});
