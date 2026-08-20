import { z } from "zod";
import { applicationUploadQuery, createRouter, staffOrAdminQuery } from "./middleware";
import {
  storageUpload,
  storageDelete,
  storageCreateSignedUrl,
  STORAGE_BUCKET,
  SIGNED_URL_EXPIRY,
  isStorageConfigured,
} from "./lib/local-storage";
import { TRPCError } from "@trpc/server";
import { getErrorMessage } from "./lib/errors";
import { sanitizeDocumentFileName, validateDocumentFile } from "./lib/document-upload";
import { auditLog } from "./lib/audit-log";
import { assertApplicantBelongsToApplication, assertApplicationIdAccess } from "./lib/application-access";
import { recordTimelineEvent } from "./lib/application-timeline";
import { recordDocumentLifecycleEvent } from "./lib/document-lifecycle";
import { documents } from "@db/schema";
import { getDb } from "./queries/connection";
import { eq } from "drizzle-orm";

export const storageRouter = createRouter({
  // Get signed URL for viewing/downloading
  getSignedUrl: staffOrAdminQuery
    .input(z.object({ documentId: z.number().positive() }))
    .query(async ({ input }) => {
      try {
        if (!isStorageConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Storage not configured",
          });
        }

        const [document] = await getDb().select({
          storagePath: documents.storagePath,
          uploadStatus: documents.uploadStatus,
        })
          .from(documents).where(eq(documents.id, input.documentId)).limit(1);
        if (!document || document.uploadStatus === "replaced") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        }
        const { signedUrl } = await storageCreateSignedUrl(document.storagePath);

        return { signedUrl, expiresIn: SIGNED_URL_EXPIRY };
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        console.error("[Storage] getSignedUrl error:", message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
        });
      }
    }),

  // Upload document to the active server-side storage provider.
  upload: applicationUploadQuery
    .input(z.object({
      applicationId: z.number().positive(),
      applicantId: z.number().optional(),
      documentType: z.enum(["passport", "photo", "national_id", "supporting", "visa", "invoice", "gcc_residence", "sponsor_id"]),
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
      fileSize: z.number().positive(),
      base64Data: z.string().min(1), // Base64 encoded file content
      uploadedBy: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await assertApplicationIdAccess(ctx, input.applicationId);
        await assertApplicantBelongsToApplication(input.applicantId, input.applicationId);
        if (!isStorageConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Storage not configured",
          });
        }

        // Validate file
        const validationError = validateDocumentFile(input.mimeType, input.fileSize);
        if (validationError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: validationError });
        }

        const sanitizedName = sanitizeDocumentFileName(input.fileName);
        const timestamp = Date.now();
        const storedName = `${timestamp}-${sanitizedName}`;
        const storagePath = input.applicantId
          ? `applications/${input.applicationId}/applicants/${input.applicantId}/${input.documentType}/${storedName}`
          : `applications/${input.applicationId}/${input.documentType}/${storedName}`;

        // Decode base64 to Buffer
        const fileBuffer = Buffer.from(input.base64Data, "base64");
        const decodedSizeError = validateDocumentFile(input.mimeType, input.fileSize, fileBuffer.length);
        if (decodedSizeError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: decodedSizeError });
        }

        // Upload via REST API
        await storageUpload(storagePath, fileBuffer, input.mimeType);

        return {
          success: true,
          storagePath,
          storedFileName: storedName,
          bucket: STORAGE_BUCKET,
        };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const message = getErrorMessage(err);
        console.error("[Storage] upload error:", message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  // Delete document from the active server-side storage provider.
  delete: staffOrAdminQuery
    .input(z.object({ documentId: z.number().positive() }))
    .mutation(async ({ input }) => {
      try {
        if (!isStorageConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Storage not configured",
          });
        }

        const [document] = await getDb().select({
          storagePath: documents.storagePath,
          uploadStatus: documents.uploadStatus,
        })
          .from(documents).where(eq(documents.id, input.documentId)).limit(1);
        if (!document || document.uploadStatus === "replaced") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        }
        await storageDelete(document.storagePath);

        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: getErrorMessage(err) });
      }
    }),

  // Replace document (delete old + upload new)
  replace: staffOrAdminQuery
    .input(z.object({
      documentId: z.number().positive(),
      applicationId: z.number().positive(),
      applicantId: z.number().optional(),
      documentType: z.enum(["passport", "photo", "national_id", "supporting", "visa", "invoice", "gcc_residence", "sponsor_id"]),
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
      fileSize: z.number().positive(),
      base64Data: z.string().min(1),
      uploadedBy: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (!isStorageConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Storage not configured",
          });
        }

        const [document] = await getDb().select().from(documents)
          .where(eq(documents.id, input.documentId)).limit(1);
        if (!document || document.uploadStatus === "replaced" || document.applicationId !== input.applicationId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Document does not belong to application" });
        }
        if (document.applicantId !== (input.applicantId ?? null) || document.documentType !== input.documentType) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Replacement target metadata mismatch" });
        }
        await assertApplicantBelongsToApplication(input.applicantId, input.applicationId);

        // Validate the complete replacement before touching the existing file.
        const validationError = validateDocumentFile(input.mimeType, input.fileSize);
        if (validationError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: validationError });
        }

        const sanitizedName = sanitizeDocumentFileName(input.fileName);
        const timestamp = Date.now();
        const storedName = `${timestamp}-${sanitizedName}`;
        const storagePath = input.applicantId
          ? `applications/${input.applicationId}/applicants/${input.applicantId}/${input.documentType}/${storedName}`
          : `applications/${input.applicationId}/${input.documentType}/${storedName}`;

        const fileBuffer = Buffer.from(input.base64Data, "base64");
        const decodedSizeError = validateDocumentFile(input.mimeType, input.fileSize, fileBuffer.length);
        if (decodedSizeError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: decodedSizeError });
        }

        // Upload first so a failed replacement never destroys the current document.
        await storageUpload(storagePath, fileBuffer, input.mimeType);
        await getDb().update(documents).set({
          originalFileName: input.fileName,
          storedFileName: storedName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          storagePath,
          uploadStatus: "uploaded",
          uploadedBy: input.uploadedBy ?? null,
        }).where(eq(documents.id, document.id));
        await storageDelete(document.storagePath);
        await recordTimelineEvent({
          applicationId: input.applicationId,
          eventName: "DOCUMENT_REPLACED",
          eventSource: "STORAGE_API",
          actorType: ctx.isAdmin ? "ADMIN" : "STAFF",
          summary: `${input.documentType} document replaced`,
        });
        await recordDocumentLifecycleEvent({
          applicationId: input.applicationId,
          documentId: document.id,
          applicantId: input.applicantId,
          eventType: "REPLACED",
          actorType: ctx.isAdmin ? "ADMIN" : "STAFF",
          reason: "Authorized document replacement",
        });
        auditLog("document.upload", "success", "customer");

        return {
          success: true,
          storagePath,
          storedFileName: storedName,
          bucket: STORAGE_BUCKET,
        };
      } catch (err: unknown) {
        auditLog("document.upload", "failure", "customer");
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: getErrorMessage(err) });
      }
    }),
});
