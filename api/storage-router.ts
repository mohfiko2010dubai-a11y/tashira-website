import { z } from "zod";
import { createRouter, staffOrAdminQuery, uploadQuery } from "./middleware";
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

export const storageRouter = createRouter({
  // Get signed URL for viewing/downloading
  getSignedUrl: staffOrAdminQuery
    .input(z.object({ path: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        if (!isStorageConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Storage not configured",
          });
        }

        const { signedUrl } = await storageCreateSignedUrl(input.path);

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
  upload: uploadQuery
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
    .mutation(async ({ input }) => {
      try {
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
        const storagePath = `applications/${input.applicationId}/${input.documentType}/${storedName}`;

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
    .input(z.object({ path: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        if (!isStorageConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Storage not configured",
          });
        }

        await storageDelete(input.path);

        return { success: true };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: getErrorMessage(err) });
      }
    }),

  // Replace document (delete old + upload new)
  replace: staffOrAdminQuery
    .input(z.object({
      oldPath: z.string().min(1),
      applicationId: z.number().positive(),
      applicantId: z.number().optional(),
      documentType: z.enum(["passport", "photo", "national_id", "supporting", "visa", "invoice", "gcc_residence", "sponsor_id"]),
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
      fileSize: z.number().positive(),
      base64Data: z.string().min(1),
      uploadedBy: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        if (!isStorageConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Storage not configured",
          });
        }

        // Validate new file
        const validationError = validateDocumentFile(input.mimeType, input.fileSize);
        if (validationError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: validationError });
        }

        // Delete old file
        await storageDelete(input.oldPath);

        // Upload new file
        const sanitizedName = sanitizeDocumentFileName(input.fileName);
        const timestamp = Date.now();
        const storedName = `${timestamp}-${sanitizedName}`;
        const storagePath = `applications/${input.applicationId}/${input.documentType}/${storedName}`;

        const fileBuffer = Buffer.from(input.base64Data, "base64");
        const decodedSizeError = validateDocumentFile(input.mimeType, input.fileSize, fileBuffer.length);
        if (decodedSizeError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: decodedSizeError });
        }

        await storageUpload(storagePath, fileBuffer, input.mimeType);

        return {
          success: true,
          storagePath,
          storedFileName: storedName,
          bucket: STORAGE_BUCKET,
        };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: getErrorMessage(err) });
      }
    }),
});
