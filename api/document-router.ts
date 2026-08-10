import { z } from "zod";
import { applicationUploadQuery, createRouter, staffOrAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { documents } from "@db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auditLog } from "./lib/audit-log";
import { assertApplicantBelongsToApplication, assertApplicationIdAccess } from "./lib/application-access";
import { TRPCError } from "@trpc/server";

const DOCUMENT_TYPES = [
  "passport", "photo", "national_id", "supporting",
  "visa", "invoice", "gcc_residence", "sponsor_id",
] as const;

const UPLOAD_STATUSES = ["pending", "uploaded", "failed", "replaced"] as const;

export const documentRouter = createRouter({
  // List documents by application
  listByApplication: staffOrAdminQuery
    .input(z.object({
      applicationId: z.number().positive(),
      search: z.string().optional(),
      documentType: z.enum(DOCUMENT_TYPES).optional(),
      sortBy: z.enum(["createdAt", "fileSize", "documentType"]).default("createdAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      const conditions = [eq(documents.applicationId, input.applicationId)];

      // Apply document type filter
      if (input.documentType) {
        conditions.push(eq(documents.documentType, input.documentType));
      }

      // Apply sorting
      const orderFn = input.sortOrder === "asc" ? sql`${documents.createdAt} ASC` : sql`${documents.createdAt} DESC`;

      const results = await db.select().from(documents)
        .where(and(...conditions))
        .orderBy(orderFn);

      // Apply search filter in-memory (filename search)
      let filtered = results;
      if (input.search?.trim()) {
        const q = input.search.toLowerCase();
        filtered = results.filter((d) =>
          d.originalFileName.toLowerCase().includes(q) ||
          d.documentType.toLowerCase().includes(q),
        );
      }

      return filtered;
    }),

  // Get single document
  getById: staffOrAdminQuery
    .input(z.object({ id: z.number().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [doc] = await db.select().from(documents)
        .where(eq(documents.id, input.id))
        .limit(1);
      return doc || null;
    }),

  // Create document metadata after a successful storage upload.
  create: applicationUploadQuery
    .input(z.object({
      applicationId: z.number().positive(),
      applicantId: z.number().optional(),
      documentType: z.enum(DOCUMENT_TYPES),
      originalFileName: z.string().min(1).max(255),
      storedFileName: z.string().min(1).max(255),
      mimeType: z.string().min(1).max(100),
      fileSize: z.number().positive(),
      storagePath: z.string().min(1).max(500),
      uploadStatus: z.enum(UPLOAD_STATUSES).default("uploaded"),
      uploadedBy: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertApplicationIdAccess(ctx, input.applicationId);
      await assertApplicantBelongsToApplication(input.applicantId, input.applicationId);
      const expectedPrefix = `applications/${input.applicationId}/${input.documentType}/`;
      if (!input.storagePath.startsWith(expectedPrefix) || !input.storagePath.endsWith(`/${input.storedFileName}`)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Document storage path does not match application metadata" });
      }
      const db = getDb();
      const [result] = await db.insert(documents).values({
        applicationId: input.applicationId,
        applicantId: input.applicantId || null,
        documentType: input.documentType,
        originalFileName: input.originalFileName,
        storedFileName: input.storedFileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        storagePath: input.storagePath,
        uploadStatus: input.uploadStatus,
        uploadedBy: input.uploadedBy || null,
      }).$returningId();

      return { id: result.id, success: true };
    }),

  // Update upload status
  updateStatus: staffOrAdminQuery
    .input(z.object({
      id: z.number().positive(),
      uploadStatus: z.enum(UPLOAD_STATUSES),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(documents)
        .set({ uploadStatus: input.uploadStatus })
        .where(eq(documents.id, input.id));
      return { success: true };
    }),

  // Delete document record + storage file
  delete: staffOrAdminQuery
    .input(z.object({ id: z.number().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Get document to find storage path
      const [doc] = await db.select().from(documents)
        .where(eq(documents.id, input.id))
        .limit(1);

      if (!doc) {
        return { success: false, error: "Document not found" };
      }

      // Delete from database
      await db.delete(documents).where(eq(documents.id, input.id));
      auditLog("document.delete", "success", ctx.isAdmin ? "admin" : "staff");

      return {
        success: true,
        storagePath: doc.storagePath,
      };
    }),

  // Count documents by application
  countByApplication: staffOrAdminQuery
    .input(z.object({ applicationId: z.number().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [result] = await db.select({
        count: sql<number>`COUNT(*)`,
        totalSize: sql<number>`COALESCE(SUM(${documents.fileSize}), 0)`,
      })
        .from(documents)
        .where(eq(documents.applicationId, input.applicationId));

      return {
        count: result?.count || 0,
        totalSize: Number(result?.totalSize || 0),
      };
    }),
});
