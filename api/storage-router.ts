import { z } from "zod";
import { assertDocumentNotSubmissionEvidence } from './lib/submission-evidence';
import { applicationUploadQuery, createRouter, staffOrAdminQuery } from "./middleware";
import {
  storageUpload,
  storageDelete,
  STORAGE_BUCKET,
  isStorageConfigured,
} from "./lib/local-storage";
import { TRPCError } from "@trpc/server";
import { getErrorMessage } from "./lib/errors";
import { prepareDocumentUpload } from "./lib/prepare-document-upload";
import { UPLOAD_RETRY_GUIDANCE } from "../contracts/document-upload-policy";
import { auditLog } from "./lib/audit-log";
import { assertApplicantBelongsToApplication, assertApplicationIdAccess } from "./lib/application-access";
import { recordTimelineEvent } from "./lib/application-timeline";
import { recordDocumentLifecycleEvent } from "./lib/document-lifecycle";
import { documents } from "@db/schema";
import { getDb } from "./queries/connection";
import { eq } from "drizzle-orm";
import { issueStaffDocumentGrant, STAFF_DOCUMENT_TTL_SECONDS } from './lib/staff-document-access';

export const storageRouter = createRouter({
  // Get signed URL for viewing/downloading
  getSignedUrl: staffOrAdminQuery
    .input(z.object({ documentId: z.number().positive(), action: z.enum(['VIEW', 'DOWNLOAD']).default('VIEW') }))
    .query(async ({ input, ctx }) => {
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
        if (!ctx.staffId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in with your named account to open this document.' });
        return { signedUrl: issueStaffDocumentGrant(input.documentId, ctx.staffId, input.action), expiresIn: STAFF_DOCUMENT_TTL_SECONDS };
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
      mimeType: z.string(),
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

        const prepared = await prepareDocumentUpload(input);
        const sanitizedName = prepared.fileName;
        const timestamp = Date.now();
        const storedName = `${timestamp}-${sanitizedName}`;
        const storagePath = input.applicantId
          ? `applications/${input.applicationId}/applicants/${input.applicantId}/${input.documentType}/${storedName}`
          : `applications/${input.applicationId}/${input.documentType}/${storedName}`;

        await storageUpload(storagePath, prepared.buffer, prepared.mimeType);

        return {
          success: true,
          storagePath,
          storedFileName: storedName,
          bucket: STORAGE_BUCKET,
          mimeType: prepared.mimeType,
          fileSize: prepared.fileSize,
        };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: UPLOAD_RETRY_GUIDANCE });
      }
    }),

  // Delete document from the active server-side storage provider.
  delete: staffOrAdminQuery
    .input(z.object({ documentId: z.number().positive() }))
    .mutation(async ({ input }) => {
      await assertDocumentNotSubmissionEvidence(input.documentId);
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
      mimeType: z.string(),
      fileSize: z.number().positive(),
      base64Data: z.string().min(1),
      uploadedBy: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertDocumentNotSubmissionEvidence(input.documentId);
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

        // Prepare the replacement before touching the existing document.
        const prepared = await prepareDocumentUpload(input);
        const sanitizedName = prepared.fileName;
        const timestamp = Date.now();
        const storedName = `${timestamp}-${sanitizedName}`;
        const storagePath = input.applicantId
          ? `applications/${input.applicationId}/applicants/${input.applicantId}/${input.documentType}/${storedName}`
          : `applications/${input.applicationId}/${input.documentType}/${storedName}`;

        await storageUpload(storagePath, prepared.buffer, prepared.mimeType);
        await getDb().update(documents).set({
          originalFileName: input.fileName,
          storedFileName: storedName,
          mimeType: prepared.mimeType,
          fileSize: prepared.fileSize,
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
          mimeType: prepared.mimeType,
          fileSize: prepared.fileSize,
        };
      } catch (err: unknown) {
        auditLog("document.upload", "failure", "customer");
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: getErrorMessage(err) });
      }
    }),
});
