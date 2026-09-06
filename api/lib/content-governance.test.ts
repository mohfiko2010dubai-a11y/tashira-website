import { describe, expect, it } from "vitest";
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
} from "./content-governance";

describe("content state machine", () => {
  it("follows DRAFT → IN_REVIEW → APPROVED → PUBLISHED → ARCHIVED", () => {
    expect(resolveTransition("DRAFT", "submit")?.to).toBe("IN_REVIEW");
    expect(resolveTransition("IN_REVIEW", "approve")?.to).toBe("APPROVED");
    expect(resolveTransition("APPROVED", "publish")?.to).toBe("PUBLISHED");
    expect(resolveTransition("PUBLISHED", "archive")?.to).toBe("ARCHIVED");
  });

  it("rejects impossible transitions (fail closed)", () => {
    expect(resolveTransition("DRAFT", "publish")).toBeNull();
    expect(resolveTransition("DRAFT", "approve")).toBeNull();
    expect(resolveTransition("PUBLISHED", "submit")).toBeNull();
    expect(resolveTransition("ARCHIVED", "publish")).toBeNull();
  });

  it("allows return_to_draft and unpublish paths", () => {
    expect(resolveTransition("IN_REVIEW", "return_to_draft")?.to).toBe("DRAFT");
    expect(resolveTransition("APPROVED", "return_to_draft")?.to).toBe("DRAFT");
    expect(resolveTransition("PUBLISHED", "unpublish")?.to).toBe("DRAFT");
    expect(resolveTransition("ARCHIVED", "return_to_draft")?.to).toBe("DRAFT");
  });

  it("maps each action to its dedicated permission", () => {
    expect(resolveTransition("DRAFT", "submit")?.permission).toBe("content.edit");
    expect(resolveTransition("IN_REVIEW", "approve")?.permission).toBe("content.review");
    expect(resolveTransition("APPROVED", "publish")?.permission).toBe("content.publish");
    expect(resolveTransition("PUBLISHED", "unpublish")?.permission).toBe("content.unpublish");
    expect(resolveTransition("PUBLISHED", "archive")?.permission).toBe("content.archive");
  });
});

describe("content RBAC", () => {
  it("admin bypasses permission checks", () => {
    expect(canPerform(new Set(), true, "content.publish")).toBe(true);
  });
  it("staff requires the exact permission", () => {
    expect(canPerform(new Set(["content.edit"]), false, "content.edit")).toBe(true);
    expect(canPerform(new Set(["content.edit"]), false, "content.publish")).toBe(false);
    expect(canPerform(new Set(), false, "content.view")).toBe(false);
  });
  it("writer role cannot publish or review", () => {
    const writer = new Set(["content.view", "content.create", "content.edit"]);
    expect(canPerform(writer, false, "content.review")).toBe(false);
    expect(canPerform(writer, false, "content.publish")).toBe(false);
    expect(canPerform(writer, false, "content.create")).toBe(true);
  });
});

describe("Google Ads policy safety — forbidden claims", () => {
  it("blocks guarantee and government claims in English and Arabic", () => {
    expect(findForbiddenPhrases("We offer guaranteed approval for your visa")).toContain("guaranteed approval");
    expect(findForbiddenPhrases("TASHIRA is an official government website")).toContain("official government");
    expect(findForbiddenPhrases("موافقة مضمونة على التأشيرة").length).toBeGreaterThan(0);
    expect(findForbiddenPhrases("نضمن لك الحصول على التأشيرة").length).toBeGreaterThan(0);
  });
  it("allows compliant copy", () => {
    expect(findForbiddenPhrases("TASHIRA is a private visa assistance service. Visa decisions are made solely by the relevant authorities.")).toEqual([]);
    expect(findForbiddenPhrases("خدمة خاصة للمساعدة في التأشيرات وليست جهة حكومية")).toEqual([]);
  });
});

describe("publish guards", () => {
  const base = {
    contentType: "LANDING" as const, title: "t", slug: "uae-visa",
    seoTitle: "seo", metaDescription: "meta", heroImage: null, heroImageAlt: null,
    author: null, reviewer: null, sourceAuthority: null, sourceUrl: null, lastVerifiedAt: null,
    bodyText: "compliant body copy",
  };
  it("requires SEO title and meta description", () => {
    expect(publishGuardFailures({ ...base, seoTitle: null })).toContain("SEO_TITLE_REQUIRED");
    expect(publishGuardFailures({ ...base, metaDescription: "" })).toContain("META_DESCRIPTION_REQUIRED");
    expect(publishGuardFailures(base)).toEqual([]);
  });
  it("requires hero alt text when a hero image is set", () => {
    expect(publishGuardFailures({ ...base, heroImage: "/x.jpg", heroImageAlt: null })).toContain("HERO_IMAGE_ALT_REQUIRED");
  });
  it("requires full provenance for NEWS", () => {
    const failures = publishGuardFailures({ ...base, contentType: "NEWS" });
    expect(failures).toContain("NEWS_AUTHOR_REQUIRED");
    expect(failures).toContain("NEWS_REVIEWER_REQUIRED");
    expect(failures).toContain("NEWS_SOURCE_AUTHORITY_REQUIRED");
    expect(failures).toContain("NEWS_SOURCE_URL_REQUIRED");
    expect(failures).toContain("NEWS_LAST_VERIFIED_REQUIRED");
  });
  it("passes NEWS with complete provenance", () => {
    expect(publishGuardFailures({
      ...base, contentType: "NEWS", author: "a", reviewer: "r",
      sourceAuthority: "ICP", sourceUrl: "https://icp.gov.ae", lastVerifiedAt: "2026-09-01",
    })).toEqual([]);
  });
});

describe("news verification expiry", () => {
  const now = new Date("2026-09-06T00:00:00Z");
  it("expires after 90 days", () => {
    expect(newsVerificationExpired("2026-06-01", now)).toBe(true);
    expect(newsVerificationExpired("2026-08-20", now)).toBe(false);
  });
  it("treats missing verification as expired", () => {
    expect(newsVerificationExpired(null, now)).toBe(true);
  });
});

describe("slugs and body blocks", () => {
  it("validates lowercase path slugs", () => {
    expect(isValidSlug("uae-visa/14-days")).toBe(true);
    expect(isValidSlug("guides/how-to-apply")).toBe(true);
    expect(isValidSlug("UAE Visa")).toBe(false);
    expect(isValidSlug("/leading")).toBe(false);
    expect(isValidSlug("trailing/")).toBe(false);
  });
  it("validates and flattens body blocks", () => {
    const blocks: import("./content-governance").BodyBlock[] = [
      { type: "heading", text: "H" },
      { type: "paragraph", text: "P" },
      { type: "list", items: ["a", "b"] },
      { type: "faq", items: [{ q: "q", a: "a" }] },
      { type: "cta", label: "Go", href: "/apply" },
    ];
    expect(isValidBodyBlocks(blocks)).toBe(true);
    expect(bodyBlocksToText(blocks)).toContain("H");
    expect(bodyBlocksToText(blocks)).toContain("q");
    expect(isValidBodyBlocks([{ type: "script", text: "x" }])).toBe(false);
    expect(isValidBodyBlocks("nope")).toBe(false);
  });
  it("editable statuses are DRAFT and IN_REVIEW-returned items only", () => {
    expect(isEditableStatus("DRAFT")).toBe(true);
    expect(isEditableStatus("PUBLISHED")).toBe(false);
    expect(isEditableStatus("ARCHIVED")).toBe(false);
  });
});
