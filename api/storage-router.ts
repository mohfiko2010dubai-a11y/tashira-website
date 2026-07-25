import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  storageUpload,
  storageDelete,
  storageCreateSignedUrl,
  STORAGE_BUCKET,
  SIGNED_URL_EXPIRY,
  isStorageConfigured,
} from "./lib/local-storage";
import { TRPCError } from "@trpc/server";

// Validate file type
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file

// Sanitize filename: remove path traversal, special chars
function sanitizeFileName(name: string): string {
  // Remove path traversal attempts
  const noPath = name.replace(/\\/g, "/").split("/").pop() || "file";
  // Remove non-alphanumeric except dots, hyphens, underscores, spaces
  const clean = noPath.replace(/[^a-zA-Z0-9._\- ]/g, "");
  // Limit length
  return clean.slice(0, 200) || "file";
}

function validateFile(mimeType: string, size: number): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: `File type not allowed. Allowed: PDF, JPG, JPEG, PNG` };
  }
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds 100MB limit` };
  }
  return { valid: true };
}

export const storageRouter = createRouter({
  // Get signed URL for viewing/downloading
  getSignedUrl: publicQuery
    .input(z.object({ path: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        if (!isStorageConfigured()) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Storage not configured",
          });
        }

        const { signedUrl } = await storageCreateSignedUrl(input.path, SIGNED_URL_EXPIRY);

        return { signedUrl, expiresIn: SIGNED_URL_EXPIRY };
      } catch (err: any) {
        console.error("[Storage] getSignedUrl error:", err.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err.message || "Failed to generate signed URL",
        });
      }
    }),

  // Upload document to Supabase Storage
  upload: publicQuery
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
        const validation = validateFile(input.mimeType, input.fileSize);
        if (!validation.valid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: validation.error });
        }

        const sanitizedName = sanitizeFileName(input.fileName);
        const timestamp = Date.now();
        const storedName = `${timestamp}-${sanitizedName}`;
        const storagePath = `applications/${input.applicationId}/${input.documentType}/${storedName}`;

        // Decode base64 to Buffer
        const fileBuffer = Buffer.from(input.base64Data, "base64");

        // Upload via REST API
        await storageUpload(storagePath, fileBuffer, input.mimeType);

        return {
          success: true,
          storagePath,
          storedFileName: storedName,
          bucket: STORAGE_BUCKET,
        };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        console.error("[Storage] upload error:", err.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  // Delete document from Supabase
  delete: publicQuery
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
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  // Replace document (delete old + upload new)
  replace: publicQuery
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
        const validation = validateFile(input.mimeType, input.fileSize);
        if (!validation.valid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: validation.error });
        }

        // Delete old file
        await storageDelete(input.oldPath);

        // Upload new file
        const sanitizedName = sanitizeFileName(input.fileName);
        const timestamp = Date.now();
        const storedName = `${timestamp}-${sanitizedName}`;
        const storagePath = `applications/${input.applicationId}/${input.documentType}/${storedName}`;

        const fileBuffer = Buffer.from(input.base64Data, "base64");

        await storageUpload(storagePath, fileBuffer, input.mimeType);

        return {
          success: true,
          storagePath,
          storedFileName: storedName,
          bucket: STORAGE_BUCKET,
        };
      } catch (err: any) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),
});
