import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminQuery, applicationAccessQuery, applicationSubmissionQuery, applicationUploadQuery, chatQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { applicants, applications, documents } from "@db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { getErrorMessage } from "./lib/errors";
import { LOCAL_STORAGE_METADATA, storageUpload } from "./lib/local-storage";
import { sanitizeDocumentFileName, validateDocumentFile } from "./lib/document-upload";
import { auditLog } from "./lib/audit-log";
import { assertApplicantBelongsToApplication, assertApplicationIdAccess, assertApplicationReferenceAccess } from "./lib/application-access";
import { createCustomerApplicationCookie } from "./lib/customer-session";
import { documentUploadEvent, hasTimelineEvent, hasTimelinePolicyAcceptance, recordTimelineEvent } from "./lib/application-timeline";
import { ACCEPTED_POLICY_TYPES, TERMS_POLICY_EFFECTIVE_DATE, TERMS_POLICY_VERSION } from "@contracts/constants";
import { quoteApplicationPrice, saveApplicationPriceSnapshot } from "./lib/pricing-engine";
import { assertCompleteApplicantSequence, assertRequiredApplicantDocuments } from "./lib/wizard-applicants";

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

type ApplicantInput = {
  fullName?: string;
  nationality?: string;
  passportNumber?: string;
  passportType?: string;
  passportExpiry?: string;
  profession?: string;
  countryFrom?: string;
};

async function persistApplicant(applicationId: number, applicantIndex: number, input: ApplicantInput) {
  const db = getDb();
  const [existing] = await db.select().from(applicants)
    .where(and(eq(applicants.applicationId, applicationId), eq(applicants.applicantIndex, applicantIndex)))
    .limit(1);

  const values: Partial<typeof applicants.$inferInsert> = {};
  if (input.fullName !== undefined) values.fullName = input.fullName;
  if (input.nationality !== undefined) values.nationality = input.nationality;
  if (input.passportNumber !== undefined) values.passportNumber = input.passportNumber;
  if (input.passportType !== undefined) values.passportType = input.passportType;
  else if (existing && !existing.passportType) values.passportType = "ordinary";
  if (input.passportExpiry !== undefined) values.passportExpiry = input.passportExpiry;
  if (input.profession !== undefined) values.profession = input.profession;
  if (input.countryFrom !== undefined) values.travelingFrom = input.countryFrom;

  if (existing) {
    const updated = Object.keys(values).length > 0;
    if (updated) {
      await db.update(applicants).set(values).where(eq(applicants.id, existing.id));
    }
    return { id: existing.id, created: false, updated };
  }

  if (!input.fullName) return undefined;
  const [created] = await db.insert(applicants).values({
    applicationId,
    applicantIndex,
    fullName: input.fullName,
    nationality: input.nationality,
    passportNumber: input.passportNumber,
    passportType: input.passportType ?? "ordinary",
    passportExpiry: input.passportExpiry,
    profession: input.profession,
    travelingFrom: input.countryFrom,
  }).$returningId();
  return { id: created.id, created: true, updated: false };
}

const completeApplicantSchema = z.object({
  applicantIndex: z.number().int().min(0).max(19),
  fullName: z.string().min(1),
  nationality: z.string().min(1),
  passportNumber: z.string().min(1),
  passportExpiry: z.string().min(1),
  profession: z.string().min(1),
  countryFrom: z.string().min(1),
});

export const wizardRouter = createRouter({
  quoteApplication: applicationSubmissionQuery
    .input(z.object({
      visaType: z.string().min(1),
      processingType: z.string().min(1),
      applicantCount: z.number().int().min(1).max(20),
    }))
    .mutation(async ({ input }) => {
      const quote = await quoteApplicationPrice({
        serviceCode: input.visaType,
        processingType: mapProcessingType(input.processingType),
        applicantCount: input.applicantCount,
      });
      return {
        unitPrice: quote.unitPrice,
        totalPrice: quote.totalPrice,
        currency: quote.currency,
        applicantCount: quote.applicantCount,
      };
    }),

  // Start a new submitted application (called on first step)
  startApplication: applicationSubmissionQuery
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
      applicantCount: z.number().int().min(1).max(20).default(1),
      totalAmount: z.number().min(0).default(0),
      chatSessionId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log("[Wizard] Starting application:", input.referenceNumber);
      try {
        const db = getDb();
        await db.insert(applications).values({
          referenceNumber: input.referenceNumber,
          baseType: (input.applicantCount ?? 1) > 1 ? "family" : "single",
          residenceType: input.residenceStatus ? mapResidenceType(input.residenceStatus) : "non-gcc",
          visaType: input.visaType || "",
          processingType: mapProcessingType(input.processingType),
          contactEmail: input.email || "",
          contactPhone: input.phone || "",
          totalAmountAed: "0.00",
          totalAmountUsd: "0.00",
          exchangeRate: "0.0000",
          status: "submitted",
          paymentStatus: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const [inserted] = await db.select({ id: applications.id })
          .from(applications)
          .where(eq(applications.referenceNumber, input.referenceNumber))
          .limit(1);

        const applicant = inserted
          ? await persistApplicant(inserted.id, 0, input)
          : undefined;
        if (inserted) {
          await recordTimelineEvent({
            applicationId: inserted.id,
            eventName: "APPLICATION_CREATED",
            eventSource: "CHATBOT_WIZARD",
            actorType: "CUSTOMER",
            sessionReference: input.chatSessionId,
            summary: "Application created in chatbot wizard",
          });
          if (applicant?.created) await recordTimelineEvent({
            applicationId: inserted.id,
            eventName: "APPLICANT_ADDED",
            eventSource: "CHATBOT_WIZARD",
            actorType: "CUSTOMER",
            actorReference: `applicant:${applicant.id}`,
            summary: "Primary applicant added",
          });
        }

        ctx.resHeaders.append("set-cookie", createCustomerApplicationCookie(ctx.req.headers, input.referenceNumber));
        return {
          success: true,
          referenceNumber: input.referenceNumber,
          applicationId: inserted?.id,
          applicantId: applicant?.id,
          applicantIndex: 0,
        };
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Wizard] Failed to start application:", message);
        throw new Error(`Failed to start application: ${message}`);
      }
    }),

  // Update an existing submitted application (called after each step)
  updateApplication: chatQuery
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
      applicantCount: z.number().int().min(1).max(20).optional(),
      totalAmount: z.number().min(0).optional(),
      lastStep: z.string().optional(),
      applicantIndex: z.number().int().min(0).max(19).default(0),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        assertApplicationReferenceAccess(ctx, input.referenceNumber);
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
        await db.update(applications)
          .set(updateData)
          .where(eq(applications.referenceNumber, input.referenceNumber));

        const [updated] = await db.select({ id: applications.id })
          .from(applications)
          .where(eq(applications.referenceNumber, input.referenceNumber))
          .limit(1);

        if (updated) {
          const applicant = await persistApplicant(updated.id, input.applicantIndex, input);
          if (applicant?.updated) await recordTimelineEvent({
            applicationId: updated.id,
            eventName: "APPLICANT_UPDATED",
            eventSource: "CHATBOT_WIZARD",
            actorType: "CUSTOMER",
            actorReference: `applicant:${applicant.id}`,
            summary: `Applicant ${input.applicantIndex + 1} updated`,
          });
          if (applicant?.created) await recordTimelineEvent({
            applicationId: updated.id,
            eventName: "APPLICANT_ADDED",
            eventSource: "CHATBOT_WIZARD",
            actorType: "CUSTOMER",
            actorReference: `applicant:${applicant.id}`,
            summary: `Applicant ${input.applicantIndex + 1} added`,
          });

          return {
            success: true,
            referenceNumber: input.referenceNumber,
            applicationId: updated.id,
            applicantId: applicant?.id,
            applicantIndex: input.applicantIndex,
          };
        }

        return { success: true, referenceNumber: input.referenceNumber, applicationId: undefined };
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("[Wizard] Failed to update application:", message);
        throw new Error(`Failed to update application: ${message}`);
      }
    }),

  // Submit complete application (called on CONFIRM)
  submitApplication: applicationSubmissionQuery
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
      applicantCount: z.number().int().min(1).max(20),
      totalAmount: z.number().min(0),
      policyVersion: z.literal(TERMS_POLICY_VERSION),
      applicants: z.array(completeApplicantSchema).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log("[Wizard] Submitting application:", input.referenceNumber);
      try {
        assertApplicationReferenceAccess(ctx, input.referenceNumber);
        const db = getDb();
        const processingType = mapProcessingType(input.processingType);
        const submittedApplicants = assertCompleteApplicantSequence(
          input.applicants ?? [{
            applicantIndex: 0,
            fullName: input.fullName,
            nationality: input.nationality,
            passportNumber: input.passportNumber,
            passportExpiry: input.passportExpiry,
            profession: input.profession,
            countryFrom: input.countryFrom,
          }],
          input.applicantCount,
        );
        const quote = await quoteApplicationPrice({
          serviceCode: input.visaType,
          processingType,
          applicantCount: input.applicantCount,
        });
        if (quote.currency !== "USD") throw new Error("Stripe checkout currently requires a USD pricing rule");

        const [updated] = await db.select({ id: applications.id })
          .from(applications)
          .where(eq(applications.referenceNumber, input.referenceNumber))
          .limit(1);
        if (!updated) throw new Error("Application not found");

        const persistedApplicants: Array<{ id: number; applicantIndex: number }> = [];
        for (const applicant of submittedApplicants) {
          const persisted = await persistApplicant(updated.id, applicant.applicantIndex, applicant);
          if (!persisted) throw new Error(`Unable to persist applicant ${applicant.applicantIndex + 1}`);
          persistedApplicants.push({ id: persisted.id, applicantIndex: applicant.applicantIndex });
        }
        const uploadedDocuments = await db.select({
          applicantId: documents.applicantId,
          documentType: documents.documentType,
          uploadStatus: documents.uploadStatus,
        }).from(documents).where(eq(documents.applicationId, updated.id));
        assertRequiredApplicantDocuments(persistedApplicants, uploadedDocuments);

        await db.update(applications)
          .set({
            baseType: input.applicantCount > 1 ? "family" : "single",
            residenceType: mapResidenceType(input.residenceStatus),
            visaType: input.visaType,
            processingType,
            arrivalDate: input.arrivalDate,
            contactEmail: input.email,
            contactPhone: input.phone,
            totalAmountAed: quote.totalInBaseCurrency.toFixed(2),
            totalAmountUsd: quote.totalPrice.toFixed(2),
            exchangeRate: quote.exchangeRateToBase.toFixed(4),
            status: "documents_pending",
            paymentStatus: "pending",
            updatedAt: new Date(),
          })
          .where(eq(applications.referenceNumber, input.referenceNumber));

        await saveApplicationPriceSnapshot(updated.id, quote);
        if (!await hasTimelineEvent(updated.id, "APPLICATION_SUBMITTED")) await recordTimelineEvent({
            applicationId: updated.id,
            eventName: "APPLICATION_SUBMITTED",
            eventSource: "CHATBOT_WIZARD",
            actorType: "CUSTOMER",
            resultingState: "documents_pending",
            summary: "Application submitted",
        });
        if (!await hasTimelinePolicyAcceptance(updated.id, input.policyVersion)) await recordTimelineEvent({
            applicationId: updated.id,
            eventName: "POLICY_ACCEPTED",
            eventSource: "CHATBOT_WIZARD",
            actorType: "CUSTOMER",
            policyVersion: input.policyVersion,
            summary: `${ACCEPTED_POLICY_TYPES.join(", ")} accepted; effective ${TERMS_POLICY_EFFECTIVE_DATE}`,
        });

        return {
          success: true,
          referenceNumber: input.referenceNumber,
          applicationId: updated.id,
          quote: { totalPrice: quote.totalPrice, currency: quote.currency },
        };
      } catch (error: unknown) {
        console.error("[Wizard] Failed to submit application", {
          category: error instanceof Error ? error.constructor.name : "UnknownError",
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "We couldn't save your application. Please try again. If the problem continues, contact TASHIRA support.",
        });
      }
    }),

  // List submitted applications (for Chat Inbox tracking)
  listIncomplete: adminQuery
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
  listPending: adminQuery
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
  getByReference: applicationAccessQuery
    .input(z.object({ referenceNumber: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        assertApplicationReferenceAccess(ctx, input.referenceNumber);
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

  getProgress: applicationAccessQuery
    .input(z.object({ referenceNumber: z.string() }))
    .query(async ({ input, ctx }) => {
      assertApplicationReferenceAccess(ctx, input.referenceNumber);
      const db = getDb();
      const [application] = await db.select().from(applications)
        .where(eq(applications.referenceNumber, input.referenceNumber))
        .limit(1);
      if (!application) return null;
      const applicantRows = await db.select().from(applicants)
        .where(eq(applicants.applicationId, application.id))
        .orderBy(applicants.applicantIndex);
      const documentRows = await db.select({
        id: documents.id,
        applicantId: documents.applicantId,
        documentType: documents.documentType,
        uploadStatus: documents.uploadStatus,
      }).from(documents).where(eq(documents.applicationId, application.id));
      return { application, applicants: applicantRows, documents: documentRows };
    }),

  // Upload documents for a wizard application
  uploadDocuments: applicationUploadQuery
    .input(z.object({
      applicationId: z.number().positive(),
      applicantId: z.number().positive(),
      applicantIndex: z.number().int().min(0).max(19),
      documentType: z.enum(["passport", "photo", "national_id", "supporting", "visa", "invoice", "gcc_residence", "sponsor_id"]),
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
      fileSize: z.number().positive(),
      base64Data: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await assertApplicationIdAccess(ctx, input.applicationId);
        await assertApplicantBelongsToApplication(input.applicantId, input.applicationId, input.applicantIndex);
        const db = getDb();

        // Decode base64
        const fileBuffer = Buffer.from(input.base64Data, "base64");
        const validationError = validateDocumentFile(input.mimeType, input.fileSize, fileBuffer.length);
        if (validationError) throw new Error(validationError);

        // Create stored filename
        const timestamp = Date.now();
        const storedName = `${timestamp}-${sanitizeDocumentFileName(input.fileName)}`;
        const storagePath = `applications/${input.applicationId}/applicants/${input.applicantId}/${input.documentType}/${storedName}`;

        // Persist at the same canonical path recorded in MySQL and served by /storage/*.
        await storageUpload(storagePath, fileBuffer, input.mimeType);

        // Insert into documents table
        await db.insert(documents).values({
          applicationId: input.applicationId,
          applicantId: input.applicantId,
          documentType: input.documentType,
          originalFileName: input.fileName,
          storedFileName: storedName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          ...LOCAL_STORAGE_METADATA,
          storagePath: storagePath,
          uploadStatus: "uploaded",
          uploadedBy: "chatbot-wizard",
        });
        await recordTimelineEvent({
          applicationId: input.applicationId,
          eventName: documentUploadEvent(input.documentType),
          eventSource: "CHATBOT_WIZARD",
          actorType: "CUSTOMER",
          actorReference: `applicant:${input.applicantId}`,
          summary: `${input.documentType} document uploaded for applicant ${input.applicantIndex + 1}`,
        });
        auditLog("document.upload", "success", "customer");

        return { success: true, storagePath, storedFileName: storedName };
      } catch (error: unknown) {
        auditLog("document.upload", "failure", "customer");
        const message = getErrorMessage(error);
        console.error("[Wizard] Failed to upload document:", message);
        throw new Error(`Failed to upload document: ${message}`);
      }
    }),
});
