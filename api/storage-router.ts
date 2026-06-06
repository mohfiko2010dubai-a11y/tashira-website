import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { supabase, STORAGE_BUCKET, SIGNED_URL_EXPIRY } from "./lib/supabase";
import { TRPCError } from "@trpc/server";

// Validate file type
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
    return { valid: false, error: `File size exceeds 10MB limit` };
  }
  return { valid: true };
}

export const storageRouter = createRouter({
  // Get signed URL for viewing/downloading
  getSignedUrl: publicQuery
    .input(z.object({ path: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(input.path, SIGNED_URL_EXPIRY);

        if (error || !data?.signedUrl) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error?.message || "Failed to generate signed URL",
          });
        }

        return { signedUrl: data.signedUrl, expiresIn: SIGNED_URL_EXPIRY };
      } catch (err: any) {
        console.error("[Storage] getSignedUrl error:", err.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
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
        // Validate file
        const validation = validateFile(input.mimeType, input.fileSize);
        if (!validation.valid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: validation.error });
        }

        const sanitizedName = sanitizeFileName(input.fileName);
        const timestamp = Date.now();
        const ext = sanitizedName.split(".").pop() || "bin";
        const storedName = `${timestamp}-${sanitizedName}`;
        const storagePath = `applications/${input.applicationId}/${input.documentType}/${storedName}`;

        // Decode base64 to Buffer
        const fileBuffer = Buffer.from(input.base64Data, "base64");

        // Upload to Supabase
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, fileBuffer, {
            contentType: input.mimeType,
            upsert: false,
          });

        if (error) {
          console.error("[Storage] Upload error:", error.message);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Upload failed: ${error.message}`,
          });
        }

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
        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([input.path]);

        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Delete failed: ${error.message}`,
          });
        }

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
        // Validate new file
        const validation = validateFile(input.mimeType, input.fileSize);
        if (!validation.valid) {
          throw new TRPCError({ code: "BAD_REQUEST", message: validation.error });
        }

        // Delete old file
        await supabase.storage.from(STORAGE_BUCKET).remove([input.oldPath]);

        // Upload new file
        const sanitizedName = sanitizeFileName(input.fileName);
        const timestamp = Date.now();
        const storedName = `${timestamp}-${sanitizedName}`;
        const storagePath = `applications/${input.applicationId}/${input.documentType}/${storedName}`;

        const fileBuffer = Buffer.from(input.base64Data, "base64");

        const { error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, fileBuffer, {
            contentType: input.mimeType,
            upsert: false,
          });

        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Replace upload failed: ${error.message}`,
          });
        }

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
