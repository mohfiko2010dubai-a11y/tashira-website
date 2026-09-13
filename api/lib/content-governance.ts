import rules from "../../contracts/marketing-compliance-rules.json";
import { findMarketingViolations } from "../../contracts/marketing-compliance";
/**
 * Content platform governance: controlled state machine, RBAC mapping,
 * publication guards (misleading-phrase scan, SEO completeness, news
 * sourcing), and verification-expiry rules. Pure functions — unit tested.
 */

export type ContentStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED";
export type ContentAction = "submit" | "approve" | "publish" | "unpublish" | "archive" | "return_to_draft";
export type ContentType = "LANDING" | "GUIDE" | "NEWS";

export type ContentPermission =
  | "content.view" | "content.create" | "content.edit" | "content.review"
  | "content.publish" | "content.unpublish" | "content.archive"
  | "content.manage_seo" | "content.manage_redirects" | "content.manage_media";

interface TransitionRule { to: ContentStatus; permission: ContentPermission }

/** Controlled state machine. Anything not listed here FAILS CLOSED. */
export const CONTENT_TRANSITIONS: Readonly<Record<ContentStatus, Readonly<Partial<Record<ContentAction, TransitionRule>>>>> = {
  DRAFT: {
    submit: { to: "IN_REVIEW", permission: "content.edit" },
  },
  IN_REVIEW: {
    approve: { to: "APPROVED", permission: "content.review" },
    return_to_draft: { to: "DRAFT", permission: "content.review" },
  },
  APPROVED: {
    publish: { to: "PUBLISHED", permission: "content.publish" },
    return_to_draft: { to: "DRAFT", permission: "content.review" },
  },
  PUBLISHED: {
    unpublish: { to: "DRAFT", permission: "content.unpublish" },
    archive: { to: "ARCHIVED", permission: "content.archive" },
  },
  ARCHIVED: {
    return_to_draft: { to: "DRAFT", permission: "content.archive" },
  },
};

export function resolveTransition(from: ContentStatus, action: ContentAction): TransitionRule | null {
  return CONTENT_TRANSITIONS[from]?.[action] ?? null;
}

export function canPerform(permissions: ReadonlySet<string>, isAdmin: boolean, permission: ContentPermission): boolean {
  if (isAdmin) return true; // Owner/Admin holds the full content permission set
  return permissions.has(permission);
}

/** Statuses in which the body/fields may be edited. PUBLISHED/ARCHIVED fail closed. */
export const EDITABLE_STATUSES: readonly ContentStatus[] = ["DRAFT", "IN_REVIEW", "APPROVED"];

export function isEditableStatus(status: ContentStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

const SLUG_PATTERN = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;
export function isValidSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 200 && SLUG_PATTERN.test(slug);
}

/**
 * Misleading / guarantee phrases banned by the Google Ads destination policy
 * and TASHIRA compliance rules. Publishing content containing any of these
 * is rejected (fail closed).
 */
export const FORBIDDEN_PHRASES: readonly string[] = rules.deny;

export function findForbiddenPhrases(text: string): string[] {
  return [...new Set(findMarketingViolations(text).map(match => match.phrase.toLowerCase()))];
}

/** Fields required before a publish transition is allowed. */
export interface PublishGuardInput {
  contentType: ContentType;
  title: string;
  slug: string;
  seoTitle: string | null;
  metaDescription: string | null;
  heroImage: string | null;
  heroImageAlt: string | null;
  author: string | null;
  reviewer: string | null;
  sourceAuthority: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  bodyText: string;
  excerpt?: string | null;
}

export function publishGuardFailures(input: PublishGuardInput): string[] {
  const failures: string[] = [];
  if (input.contentType !== "LANDING" && !input.excerpt?.trim()) failures.push("ARTICLE_EXCERPT_REQUIRED");
  if (!input.seoTitle?.trim()) failures.push("SEO_TITLE_REQUIRED");
  if (!input.metaDescription?.trim()) failures.push("META_DESCRIPTION_REQUIRED");
  if (input.heroImage && !input.heroImageAlt?.trim()) failures.push("HERO_IMAGE_ALT_REQUIRED");
  const phrases = findForbiddenPhrases(`${input.title}\n${input.seoTitle ?? ""}\n${input.metaDescription ?? ""}\n${input.bodyText}`);
  if (phrases.length > 0) failures.push("FORBIDDEN_PHRASES");
  if (input.contentType === "NEWS") {
    if (!input.author?.trim()) failures.push("NEWS_AUTHOR_REQUIRED");
    if (!input.reviewer?.trim()) failures.push("NEWS_REVIEWER_REQUIRED");
    if (!input.sourceAuthority?.trim()) failures.push("NEWS_SOURCE_AUTHORITY_REQUIRED");
    if (!input.sourceUrl?.trim()) failures.push("NEWS_SOURCE_URL_REQUIRED");
    if (!input.lastVerifiedAt) failures.push("NEWS_LAST_VERIFIED_REQUIRED");
  }
  return failures;
}

/** News older than this without re-verification enters the admin review queue. */
export const NEWS_VERIFY_MAX_AGE_DAYS = 90;

export function newsVerificationExpired(lastVerifiedAt: string | null, now: Date): boolean {
  if (!lastVerifiedAt) return true;
  const verified = new Date(lastVerifiedAt);
  if (Number.isNaN(verified.getTime())) return true;
  const ageMs = now.getTime() - verified.getTime();
  return ageMs > NEWS_VERIFY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/** Body block shapes the public renderer supports. */
export type BodyBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "faq"; items: { q: string; a: string }[] }
  | { type: "cta"; label: string; href: string; note?: string };

export function isValidBodyBlocks(value: unknown): value is BodyBlock[] {
  if (!Array.isArray(value)) return false;
  return value.every((block) => {
    if (typeof block !== "object" || block === null) return false;
    const b = block as Record<string, unknown>;
    switch (b.type) {
      case "heading":
      case "paragraph":
        return typeof b.text === "string" && b.text.trim().length > 0;
      case "list":
        return Array.isArray(b.items) && b.items.every((i) => typeof i === "string");
      case "faq":
        return Array.isArray(b.items) && b.items.every((i) =>
          typeof i === "object" && i !== null
          && typeof (i as Record<string, unknown>).q === "string"
          && typeof (i as Record<string, unknown>).a === "string");
      case "cta":
        return typeof b.label === "string" && typeof b.href === "string" && b.href.startsWith("/");
      default:
        return false;
    }
  });
}

export function bodyBlocksToText(blocks: BodyBlock[]): string {
  return blocks.map((block) => {
    switch (block.type) {
      case "heading":
      case "paragraph":
        return block.text;
      case "list":
        return block.items.join("\n");
      case "faq":
        return block.items.map((i) => `${i.q}\n${i.a}`).join("\n");
      case "cta":
        return block.label;
    }
  }).join("\n");
}
