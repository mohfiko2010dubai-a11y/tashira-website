import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, documents } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

function mapResidenceType(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("gcc citizen with")) return "gcc-accompany";
  if (s.includes("accompanying gcc")) return "non-gcc-accompany";
  if (s.startsWith("gcc")) return "gcc-resident";
  return "non-gcc";
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
          processingType: input.processingType?.toLowerCase() || "",
          totalApplicants: input.applicantCount ?? 1,
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
      } catch (error: any) {
        console.error("[Wizard] Failed to start application:", error.message);
        throw new Error(`Failed to start application: ${error.message}`);
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

        const updateData: any = {
          updatedAt: new Date(),
        };

        if (input.whoTraveling !== undefined) updateData.baseType = input.applicantCount && input.applicantCount > 1 ? "family" : "single";
        if (input.residenceStatus !== undefined) updateData.residenceType = mapResidenceType(input.residenceStatus);
        if (input.visaType !== undefined) updateData.visaType = input.visaType;
        if (input.processingType !== undefined) updateData.processingType = input.processingType.toLowerCase();
        if (input.fullName !== undefined) {
          updateData.fullName = input.fullName;
          updateData.applicantName = input.fullName;
        }
        if (input.nationality !== undefined) updateData.nationality = input.nationality;
        if (input.passportNumber !== undefined) updateData.passportNumber = input.passportNumber;
        if (input.passportExpiry !== undefined) updateData.passportExpiry = input.passportExpiry;
        if (input.profession !== undefined) updateData.profession = input.profession;
        if (input.countryFrom !== undefined) updateData.countryFrom = input.countryFrom;
        if (input.arrivalDate !== undefined) updateData.arrivalDate = input.arrivalDate;
        if (input.email !== undefined) updateData.contactEmail = input.email;
        if (input.phone !== undefined) updateData.contactPhone = input.phone;
        if (input.applicantCount !== undefined) updateData.totalApplicants = input.applicantCount;
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
      } catch (error: any) {
        console.error("[Wizard] Failed to update application:", error.message);
        throw new Error(`Failed to update application: ${error.message}`);
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
            processingType: input.processingType.toLowerCase(),
            totalApplicants: input.applicantCount,
            fullName: input.fullName,
            applicantName: input.fullName,
            nationality: input.nationality,
            passportNumber: input.passportNumber,
            passportExpiry: input.passportExpiry,
            profession: input.profession,
            countryFrom: input.countryFrom,
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
      } catch (error: any) {
        console.error("[Wizard] Failed to submit application:", error.message);
        throw new Error(`Failed to save application: ${error.message}`);
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
      } catch (error: any) {
        console.error("[Wizard] Failed to list submitted:", error.message);
        throw new Error(`Failed to list submitted applications: ${error.message}`);
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
      } catch (error: any) {
        console.error("[Wizard] Failed to list pending:", error.message);
        throw new Error(`Failed to list pending applications: ${error.message}`);
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
      } catch (error: any) {
        console.error("[Wizard] Failed to get application:", error.message);
        throw new Error(`Failed to get application: ${error.message}`);
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

        // Create stored filename
        const timestamp = Date.now();
        const storedName = `${timestamp}-${input.fileName}`;
        const storagePath = `applications/${input.applicationId}/${input.documentType}/${storedName}`;

        // Save file locally (since Supabase is configured for local)
        const fs = await import("fs");
        const path = await import("path");
        const uploadDir = path.join(process.cwd(), "storage", "documents", String(input.applicationId));
        fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, storedName), fileBuffer);

        // Insert into documents table
        await db.insert(documents).values({
          applicationId: input.applicationId,
          documentType: input.documentType,
          originalFileName: input.fileName,
          storedFileName: storedName,
          mimeType: input.mimeType,
          fileSize: BigInt(input.fileSize),
          storagePath: storagePath,
          uploadStatus: "uploaded",
          uploadedBy: "chatbot-wizard",
        });

        return { success: true, storagePath, storedFileName: storedName };
      } catch (error: any) {
        console.error("[Wizard] Failed to upload document:", error.message);
        throw new Error(`Failed to upload document: ${error.message}`);
      }
    }),
});
