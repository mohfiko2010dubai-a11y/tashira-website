import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const page = (name: string) => new URL(`../src/pages/content/${name}`, import.meta.url);

describe("SEO content hub public experience", () => {
  it("renders disclosure, breadcrumbs, CTA and related content on CMS pages", async () => {
    const cms = await readFile(page("CmsContentPage.tsx"), "utf8");
    // Google Ads private-service disclosure is always visible
    expect(cms).toContain("t('disclosure')");
    // Breadcrumbs
    expect(cms).toContain("breadcrumbHome");
    // CTA wired to the application journey with visa context
    expect(cms).toContain("landing_cta_click");
    expect(cms).toContain("/apply?visa=");
    // Related content
    expect(cms).toContain("relatedTitle");
    expect(cms).toContain("related_content_click");
    // Synthetic staging banner
    expect(cms).toContain("syntheticNotice");
    // News provenance fields
    expect(cms).toContain("sourceAuthority");
    expect(cms).toContain("lastVerifiedAt");
    // PII-free analytics
    expect(cms).not.toMatch(/trackContentEvent\([^)]*email/i);
    expect(cms).not.toMatch(/trackContentEvent\([^)]*name/i);
  });

  it("serves SEO metadata with canonical, hreflang and OG tags", async () => {
    const seo = await readFile(new URL("../src/components/Seo.tsx", import.meta.url), "utf8");
    const head = await readFile(new URL("../src/components/PageHead.tsx", import.meta.url), "utf8");
    const server = await readFile(new URL("./lib/ssr-html.ts", import.meta.url), "utf8");
    expect(server).toContain('rel="canonical"');
    expect(head).toContain('alternate.hreflang = language');
    expect(seo).toContain('alternates={alternates}');
    expect(seo).toContain("og:title");
    expect(head).toContain('name="robots"');
    expect(seo).toContain("application/ld+json");
  });

  it("wires landing, guide and news routes plus static trust pages", async () => {
    const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
    for (const route of ["/uae-visa", "/uae-visa/:slug", "/dubai-visa", "/guides/:slug", "/news/:slug", "/about", "/editorial-policy", "/sources-and-verification"]) {
      expect(app).toContain(`path="${route}"`);
    }
    for (const adminRoute of ["/admin/content", "/admin/content/new", "/admin/content/review-queue", "/admin/content/redirects", "/admin/content/:id"]) {
      expect(app).toContain(`path="${adminRoute}"`);
    }
  });

  it("keeps the disclosure bilingual and policy-safe", async () => {
    const en = JSON.parse(await readFile(new URL("../src/i18n/locales/en/content.json", import.meta.url), "utf8"));
    const ar = JSON.parse(await readFile(new URL("../src/i18n/locales/ar/content.json", import.meta.url), "utf8"));
    expect(en.disclosure).toContain("private visa assistance service");
    expect(en.disclosure).toContain("not a government website");
    expect(ar.disclosure).toContain("خدمة خاصة");
    expect(ar.disclosure).toContain("ليست موقعًا حكوميًا");
  });

  it("prefills the application journey from landing CTAs", async () => {
    const start = await readFile(new URL("../src/pages/DynamicApplicationStart.tsx", import.meta.url), "utf8");
    expect(start).toContain('searchParams.get("visa")');
    expect(start).toContain('"14-days": "14days-single"');
    expect(start).toContain('"30-days": "30days-single"');
    expect(start).toContain('"60-days": "60days-single"');
    expect(start).toContain('"transit": "96hours-transit"');
    expect(start).toContain('visaParam === "family"');
    expect(start).not.toContain("setResidenceType");
  });
});
