import { and, desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { contentItems, contentRedirects, contentVersions } from "@db/schema";
import { createRouter, publicQuery, staffOrAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { auditLog } from "./lib/audit-log";
import {
  canPerform,
  bodyBlocksToText,
  findForbiddenPhrases,
  isEditableStatus,
  isValidBodyBlocks,
  isValidSlug,
  newsVerificationExpired,
  publishGuardFailures,
  resolveTransition,
  type ContentAction,
  type ContentPermission,
} from "./lib/content-governance";
import type { TrpcContext } from "./context";

/** Load the staff member's granted permission codes (server-side, never client-trusted). */
async function staffPermissionCodes(staffId: number): Promise<Set<string>> {
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT DISTINCT p.code AS code
      FROM operations_staff_roles sr
      JOIN operations_roles r ON r.id = sr.role_id AND r.is_active = 'ACTIVE'
      JOIN operations_role_permissions rp ON rp.role_id = r.id
      JOIN operations_permissions p ON p.id = rp.permission_id
     WHERE sr.staff_user_id = ${staffId}
       AND sr.revoked_at IS NULL
       AND sr.valid_from <= UTC_TIMESTAMP()
       AND (sr.valid_to IS NULL OR sr.valid_to > UTC_TIMESTAMP())`);
  const list = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : [];
  return new Set(
    (list as { code?: unknown }[])
      .map((row) => (typeof row.code === "string" ? row.code : null))
      .filter((code): code is string => code !== null),
  );
}

function actorName(ctx: TrpcContext): string {
  if (ctx.isAdmin) return "admin";
  if (ctx.staffId) return `staff:${ctx.staffId}`;
  return ctx.user?.email ?? "unknown";
}

async function requireContentPermission(ctx: TrpcContext, permission: ContentPermission): Promise<void> {
  const isAdmin = Boolean(ctx.isAdmin || ctx.user?.role === "admin");
  if (isAdmin) return;
  if (!ctx.staffId) throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient content permission" });
  const permissions = await staffPermissionCodes(ctx.staffId);
  if (!canPerform(permissions, false, permission)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient content permission" });
  }
}

const languageSchema = z.enum(["en", "ar"]);
const contentTypeSchema = z.enum(["LANDING", "GUIDE", "NEWS"]);
const statusSchema = z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]);

const contentFieldsSchema = z.object({
  contentType: contentTypeSchema,
  language: languageSchema,
  translationGroupId: z.string().min(1).max(64),
  title: z.string().min(2).max(255),
  slug: z.string().min(2).max(200),
  excerpt: z.string().max(500).nullish(),
  bodyBlocks: z.unknown(),
  heroImage: z.string().max(500).nullish(),
  heroImageAlt: z.string().max(255).nullish(),
  category: z.string().max(100).nullish(),
  tags: z.array(z.string().max(50)).max(20).nullish(),
  author: z.string().max(120).nullish(),
  reviewer: z.string().max(120).nullish(),
  sourceAuthority: z.string().max(120).nullish(),
  sourceUrl: z.string().url().max(500).nullish(),
  sourcePublishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  lastVerifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  seoTitle: z.string().max(255).nullish(),
  metaDescription: z.string().max(320).nullish(),
  canonicalUrl: z.string().max(500).nullish(),
  robots: z.string().max(50).default("index,follow"),
  ogTitle: z.string().max(255).nullish(),
  ogDescription: z.string().max(320).nullish(),
  ogImage: z.string().max(500).nullish(),
  structuredData: z.unknown().nullish(),
  syntheticLabel: z.boolean().default(false),
  scheduledPublishAt: z.string().nullish(),
});

function validateFields(input: z.infer<typeof contentFieldsSchema>): void {
  if (!isValidSlug(input.slug)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid slug format" });
  if (!isValidBodyBlocks(input.bodyBlocks)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid body blocks" });
  const text = `${input.title}\n${input.excerpt ?? ""}\n${bodyBlocksToText(input.bodyBlocks)}`;
  const phrases = findForbiddenPhrases(text);
  if (phrases.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Content contains prohibited claims: ${phrases.join(", ")}` });
  }
}

/** Public payload — intentionally excludes internal workflow/PII fields. */
function toPublic(item: typeof contentItems.$inferSelect) {
  return {
    contentType: item.contentType,
    language: item.language,
    translationGroupId: item.translationGroupId,
    title: item.title,
    slug: item.slug,
    excerpt: item.excerpt,
    bodyBlocks: item.bodyBlocks,
    heroImage: item.heroImage,
    heroImageAlt: item.heroImageAlt,
    category: item.category,
    tags: item.tags,
    author: item.author,
    reviewer: item.reviewer,
    sourceAuthority: item.sourceAuthority,
    sourceUrl: item.sourceUrl,
    sourcePublishedAt: item.sourcePublishedAt,
    lastVerifiedAt: item.lastVerifiedAt,
    seoTitle: item.seoTitle,
    metaDescription: item.metaDescription,
    canonicalUrl: item.canonicalUrl,
    robots: item.robots,
    ogTitle: item.ogTitle,
    ogDescription: item.ogDescription,
    ogImage: item.ogImage,
    structuredData: item.structuredData,
    syntheticLabel: item.syntheticLabel === 1,
    publishedAt: item.publishedAt,
    updatedAt: item.updatedAt,
  };
}

async function snapshotVersion(item: typeof contentItems.$inferSelect, actor: string, action: string): Promise<void> {
  const db = getDb();
  const snapshot: Record<string, unknown> = { ...item };
  delete snapshot.createdAt;
  delete snapshot.updatedAt;
  delete snapshot.publishedAt;
  delete snapshot.scheduledPublishAt;
  await db.insert(contentVersions).values({
    contentId: item.id,
    version: item.version,
    status: item.status,
    snapshot,
    actor,
    action,
  });
}

export const contentRouter = createRouter({
  // ---------------- Public (published only) ----------------
  publicList: publicQuery
    .input(z.object({ contentType: contentTypeSchema, language: languageSchema }))
    .query(async ({ input }) => {
      const db = getDb();
      const items = await db.select().from(contentItems)
        .where(and(
          eq(contentItems.contentType, input.contentType),
          eq(contentItems.language, input.language),
          eq(contentItems.status, "PUBLISHED"),
        ))
        .orderBy(desc(contentItems.publishedAt));
      return items.map(toPublic);
    }),

  publicBySlug: publicQuery
    .input(z.object({ language: languageSchema, slug: z.string().min(2).max(200) }))
    .query(async ({ input }) => {
      const db = getDb();
      const [item] = await db.select().from(contentItems)
        .where(and(
          eq(contentItems.language, input.language),
          eq(contentItems.slug, input.slug),
          eq(contentItems.status, "PUBLISHED"),
        )).limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      const otherLang = input.language === "en" ? "ar" : "en";
      const [sibling] = await db.select({ slug: contentItems.slug }).from(contentItems)
        .where(and(
          eq(contentItems.translationGroupId, item.translationGroupId),
          eq(contentItems.language, otherLang),
          eq(contentItems.status, "PUBLISHED"),
        )).limit(1);
      return { ...toPublic(item), alternateLanguage: otherLang, alternateSlug: sibling?.slug ?? null };
    }),

  /** Sitemap entries — published, indexable content only. */
  sitemapEntries: publicQuery.query(async () => {
    const db = getDb();
    const items = await db.select({
      slug: contentItems.slug,
      language: contentItems.language,
      contentType: contentItems.contentType,
      updatedAt: contentItems.updatedAt,
      robots: contentItems.robots,
    }).from(contentItems).where(eq(contentItems.status, "PUBLISHED"));
    return items.filter((item) => !item.robots.includes("noindex"));
  }),

  /** Active redirect map (used by the server for safe same-site redirects). */
  activeRedirects: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(contentRedirects).where(eq(contentRedirects.isActive, 1));
    return rows
      .filter((row) => row.fromPath.startsWith("/") && row.toPath.startsWith("/") && !row.toPath.startsWith("//"))
      .map((row) => ({ fromPath: row.fromPath, toPath: row.toPath, statusCode: row.statusCode }));
  }),

  // ---------------- Admin / staff CMS ----------------
  list: staffOrAdminQuery
    .input(z.object({
      contentType: contentTypeSchema.optional(),
      language: languageSchema.optional(),
      status: statusSchema.optional(),
    }))
    .query(async ({ input, ctx }) => {
      await requireContentPermission(ctx, "content.view");
      const db = getDb();
      const conditions = [];
      if (input.contentType) conditions.push(eq(contentItems.contentType, input.contentType));
      if (input.language) conditions.push(eq(contentItems.language, input.language));
      if (input.status) conditions.push(eq(contentItems.status, input.status));
      const items = await db.select().from(contentItems)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(contentItems.updatedAt));
      return items;
    }),

  byId: staffOrAdminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireContentPermission(ctx, "content.view");
      const db = getDb();
      const [item] = await db.select().from(contentItems).where(eq(contentItems.id, input.id)).limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      return item;
    }),

  /** News whose verification date expired (or was never set) — admin review queue. */
  reviewQueue: staffOrAdminQuery.query(async ({ ctx }) => {
    await requireContentPermission(ctx, "content.review");
    const db = getDb();
    const items = await db.select().from(contentItems)
      .where(and(eq(contentItems.contentType, "NEWS"), eq(contentItems.status, "PUBLISHED")));
    const now = new Date();
    return items.filter((item) => newsVerificationExpired(
      item.lastVerifiedAt ? String(item.lastVerifiedAt) : null, now));
  }),

  history: staffOrAdminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireContentPermission(ctx, "content.view");
      const db = getDb();
      return db.select().from(contentVersions)
        .where(eq(contentVersions.contentId, input.id))
        .orderBy(desc(contentVersions.version));
    }),

  create: staffOrAdminQuery
    .input(contentFieldsSchema)
    .mutation(async ({ input, ctx }) => {
      await requireContentPermission(ctx, "content.create");
      validateFields(input);
      const db = getDb();
      const actor = actorName(ctx);
      try {
        const insertValues: typeof contentItems.$inferInsert = {
          contentType: input.contentType,
          language: input.language,
          translationGroupId: input.translationGroupId,
          title: input.title,
          slug: input.slug,
          excerpt: input.excerpt ?? null,
          bodyBlocks: input.bodyBlocks as never,
          heroImage: input.heroImage ?? null,
          heroImageAlt: input.heroImageAlt ?? null,
          category: input.category ?? null,
          tags: (input.tags ?? null) as never,
          author: input.author ?? null,
          reviewer: input.reviewer ?? null,
          sourceAuthority: input.sourceAuthority ?? null,
          sourceUrl: input.sourceUrl ?? null,
          sourcePublishedAt: input.sourcePublishedAt ? new Date(input.sourcePublishedAt) : null,
          lastVerifiedAt: input.lastVerifiedAt ? new Date(input.lastVerifiedAt) : null,
          seoTitle: input.seoTitle ?? null,
          metaDescription: input.metaDescription ?? null,
          canonicalUrl: input.canonicalUrl ?? null,
          robots: input.robots,
          ogTitle: input.ogTitle ?? null,
          ogDescription: input.ogDescription ?? null,
          ogImage: input.ogImage ?? null,
          structuredData: (input.structuredData ?? null) as never,
          syntheticLabel: input.syntheticLabel ? 1 : 0,
          scheduledPublishAt: input.scheduledPublishAt ? new Date(input.scheduledPublishAt) : null,
          createdBy: actor,
          status: "DRAFT" as const,
        };
        const [result] = await db.insert(contentItems).values(insertValues);
        const id = Number((result as { insertId?: number }).insertId);
        const [item] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
        await snapshotVersion(item, actor, "create");
        auditLog("content.create", "success", ctx.isAdmin ? "admin" : "staff");
        return item;
      } catch (error) {
        if (error instanceof Error && error.message.includes("Duplicate entry")) {
          throw new TRPCError({ code: "CONFLICT", message: "Slug or canonical URL already exists for this locale" });
        }
        throw error;
      }
    }),

  update: staffOrAdminQuery
    .input(z.object({ id: z.number().int().positive(), expectedVersion: z.number().int().positive() }).merge(contentFieldsSchema.partial()))
    .mutation(async ({ input, ctx }) => {
      await requireContentPermission(ctx, "content.edit");
      const db = getDb();
      const [item] = await db.select().from(contentItems).where(eq(contentItems.id, input.id)).limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      if (item.version !== input.expectedVersion) {
        throw new TRPCError({ code: "CONFLICT", message: "Stale version — refresh before saving" });
      }
      if (!isEditableStatus(item.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Published or archived content cannot be edited — unpublish first" });
      }
      const merged = {
        contentType: input.contentType ?? item.contentType,
        language: input.language ?? item.language,
        translationGroupId: input.translationGroupId ?? item.translationGroupId,
        title: input.title ?? item.title,
        slug: input.slug ?? item.slug,
        excerpt: input.excerpt !== undefined ? input.excerpt : item.excerpt,
        bodyBlocks: input.bodyBlocks !== undefined ? input.bodyBlocks : item.bodyBlocks,
        heroImage: input.heroImage !== undefined ? input.heroImage : item.heroImage,
        heroImageAlt: input.heroImageAlt !== undefined ? input.heroImageAlt : item.heroImageAlt,
        category: input.category !== undefined ? input.category : item.category,
        tags: input.tags !== undefined ? input.tags : item.tags,
        author: input.author !== undefined ? input.author : item.author,
        reviewer: input.reviewer !== undefined ? input.reviewer : item.reviewer,
        sourceAuthority: input.sourceAuthority !== undefined ? input.sourceAuthority : item.sourceAuthority,
        sourceUrl: input.sourceUrl !== undefined ? input.sourceUrl : item.sourceUrl,
        sourcePublishedAt: input.sourcePublishedAt !== undefined ? input.sourcePublishedAt : item.sourcePublishedAt,
        lastVerifiedAt: input.lastVerifiedAt !== undefined ? input.lastVerifiedAt : item.lastVerifiedAt,
        seoTitle: input.seoTitle !== undefined ? input.seoTitle : item.seoTitle,
        metaDescription: input.metaDescription !== undefined ? input.metaDescription : item.metaDescription,
        canonicalUrl: input.canonicalUrl !== undefined ? input.canonicalUrl : item.canonicalUrl,
        robots: input.robots ?? item.robots,
        ogTitle: input.ogTitle !== undefined ? input.ogTitle : item.ogTitle,
        ogDescription: input.ogDescription !== undefined ? input.ogDescription : item.ogDescription,
        ogImage: input.ogImage !== undefined ? input.ogImage : item.ogImage,
        structuredData: input.structuredData !== undefined ? input.structuredData : item.structuredData,
        syntheticLabel: input.syntheticLabel !== undefined ? input.syntheticLabel : item.syntheticLabel === 1,
      };
      validateFields({
        ...merged,
        contentType: merged.contentType, language: merged.language,
        translationGroupId: merged.translationGroupId, title: merged.title, slug: merged.slug,
        excerpt: merged.excerpt, bodyBlocks: merged.bodyBlocks, robots: merged.robots, syntheticLabel: merged.syntheticLabel,
      } as z.infer<typeof contentFieldsSchema>);
      const actor = actorName(ctx);
      const nextVersion = item.version + 1;
      try {
        await db.update(contentItems).set({
          ...merged,
          bodyBlocks: merged.bodyBlocks as never,
          tags: merged.tags as never,
          structuredData: merged.structuredData as never,
          syntheticLabel: merged.syntheticLabel ? 1 : 0,
          version: nextVersion,
        } as never).where(and(eq(contentItems.id, item.id), eq(contentItems.version, input.expectedVersion)));
      } catch (error) {
        if (error instanceof Error && error.message.includes("Duplicate entry")) {
          throw new TRPCError({ code: "CONFLICT", message: "Slug or canonical URL already exists for this locale" });
        }
        throw error;
      }
      const [updated] = await db.select().from(contentItems).where(eq(contentItems.id, item.id)).limit(1);
      if (updated.version !== nextVersion) {
        throw new TRPCError({ code: "CONFLICT", message: "Concurrent edit detected — refresh before saving" });
      }
      await snapshotVersion(updated, actor, "edit");
      auditLog("content.edit", "success", ctx.isAdmin ? "admin" : "staff");
      return updated;
    }),

  transition: staffOrAdminQuery
    .input(z.object({
      id: z.number().int().positive(),
      action: z.enum(["submit", "approve", "publish", "unpublish", "archive", "return_to_draft"]),
      expectedVersion: z.number().int().positive(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [item] = await db.select().from(contentItems).where(eq(contentItems.id, input.id)).limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content not found" });
      const rule = resolveTransition(item.status, input.action as ContentAction);
      if (!rule) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Transition ${input.action} is not allowed from ${item.status}` });
      await requireContentPermission(ctx, rule.permission);
      if (item.version !== input.expectedVersion) {
        throw new TRPCError({ code: "CONFLICT", message: "Stale version — refresh before acting" });
      }
      if (rule.to === "PUBLISHED") {
        const failures = publishGuardFailures({
          contentType: item.contentType,
          title: item.title,
          slug: item.slug,
          seoTitle: item.seoTitle,
          metaDescription: item.metaDescription,
          heroImage: item.heroImage,
          heroImageAlt: item.heroImageAlt,
          author: item.author,
          reviewer: item.reviewer,
          sourceAuthority: item.sourceAuthority,
          sourceUrl: item.sourceUrl,
          lastVerifiedAt: item.lastVerifiedAt ? String(item.lastVerifiedAt) : null,
          bodyText: bodyBlocksToText(item.bodyBlocks as never),
        });
        if (failures.length > 0) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Publish blocked: ${failures.join(", ")}` });
        }
      }
      const actor = actorName(ctx);
      await db.update(contentItems).set({
        status: rule.to,
        version: item.version + 1,
        publishedAt: rule.to === "PUBLISHED" ? new Date() : item.publishedAt,
      }).where(and(eq(contentItems.id, item.id), eq(contentItems.version, input.expectedVersion)));
      const [updated] = await db.select().from(contentItems).where(eq(contentItems.id, item.id)).limit(1);
      await snapshotVersion(updated, actor, input.action);
      const eventMap: Record<ContentAction, "content.review" | "content.publish" | "content.unpublish" | "content.archive" | "content.edit"> = {
        submit: "content.edit",
        approve: "content.review",
        return_to_draft: "content.review",
        publish: "content.publish",
        unpublish: "content.unpublish",
        archive: "content.archive",
      };
      auditLog(eventMap[input.action as ContentAction], "success", ctx.isAdmin ? "admin" : "staff");
      return updated;
    }),

  // ---------------- Redirects ----------------
  listRedirects: staffOrAdminQuery.query(async ({ ctx }) => {
    await requireContentPermission(ctx, "content.view");
    const db = getDb();
    return db.select().from(contentRedirects).orderBy(desc(contentRedirects.createdAt));
  }),

  createRedirect: staffOrAdminQuery
    .input(z.object({
      fromPath: z.string().min(1).max(500),
      toPath: z.string().min(1).max(500),
      statusCode: z.union([z.literal(301), z.literal(302)]).default(301),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireContentPermission(ctx, "content.manage_redirects");
      // Redirect safety: same-site paths only, no protocol-relative or external targets.
      if (!input.fromPath.startsWith("/") || !input.toPath.startsWith("/")
        || input.fromPath.startsWith("//") || input.toPath.startsWith("//")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Redirects must be same-site absolute paths" });
      }
      const db = getDb();
      await db.insert(contentRedirects).values({
        fromPath: input.fromPath, toPath: input.toPath, statusCode: input.statusCode,
        createdBy: actorName(ctx),
      });
      auditLog("content.redirect", "success", ctx.isAdmin ? "admin" : "staff");
      return { created: true };
    }),

  deactivateRedirect: staffOrAdminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await requireContentPermission(ctx, "content.manage_redirects");
      const db = getDb();
      await db.update(contentRedirects).set({ isActive: 0 }).where(eq(contentRedirects.id, input.id));
      auditLog("content.redirect", "success", ctx.isAdmin ? "admin" : "staff");
      return { deactivated: true };
    }),
});
