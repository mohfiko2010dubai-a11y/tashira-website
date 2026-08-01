import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, documents } from "@db/schema";
import { eq } from "drizzle-orm";

export const wizardRouter = createRouter({
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
      console.log("[Wizard] Received application:", input.referenceNumber);
      try {
        const db = getDb();
        console.log("[Wizard] DB connected");
        const exchangeRate = 3.6725;
        const totalAed = input.totalAmount * exchangeRate;
        console.log("[Wizard] Calculating AED:", totalAed);

        await db.insert(applications).values({
        referenceNumber: input.referenceNumber,
        baseType: input.applicantCount > 1 ? "family" : "single",
        residenceType: input.residenceStatus.toLowerCase().includes("gcc citizen with") ? "gcc-accompany" :
          input.residenceStatus.toLowerCase().includes("accompanying gcc") ? "non-gcc-accompany" :
          input.residenceStatus.toLowerCase().startsWith("gcc") ? "gcc-resident" : "non-gcc",
        visaType: input.visaType,
        processingType: input.processingType.toLowerCase(),
        totalApplicants: input.applicantCount,
        contactEmail: input.email,
        contactPhone: input.phone,
        totalAmountAed: String(totalAed),
        totalAmountUsd: String(input.totalAmount),
        exchangeRate: String(exchangeRate),
        status: "documents_pending",
        paymentStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

        // Get the inserted application ID
        const [inserted] = await db.select({ id: applications.id })
          .from(applications)
          .where(eq(applications.referenceNumber, input.referenceNumber))
          .limit(1);

        return { success: true, referenceNumber: input.referenceNumber, applicationId: inserted?.id };
      } catch (error: any) {
        console.error("[Wizard] Failed to save application:", error.message);
        throw new Error(`Failed to save application: ${error.message}`);
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
