import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { describe, expect, it } from "vitest";
import { isHeldPublicPage, registerHeldPublicPages } from "./held-public-pages";

describe("unpublished landing hold", () => {
  it.each(["/uae-visa", "/dubai-visa", "/uae-visa/", "/en/uae-visa", "/ar/dubai-visa/"])("returns a real uncached 404 before redirects or the SPA for %s", async path => {
    const app = new Hono<{ Bindings: HttpBindings }>();
    registerHeldPublicPages(app);
    app.get("*", c => c.html('<div id="root"></div>'));
    const response = await app.request(path, { headers: { Accept: "text/html" } });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    const html = await response.text();
    expect(html).toContain(path.startsWith("/ar/") ? "<h1>الصفحة غير موجودة</h1>" : "<h1>Page not found</h1>");
    if (path.startsWith("/ar/")) expect(html).toContain('lang="ar" dir="rtl"');
  });

  it("leaves existing content and application routes alone", async () => {
    const app = new Hono<{ Bindings: HttpBindings }>();
    registerHeldPublicPages(app);
    app.get("*", c => c.text("existing page"));
    for (const path of ["/", "/apply", "/visa-prices", "/uae-visa/14-days", "/api/health"]) {
      expect((await app.request(path)).status).toBe(200);
    }
  });

  it("excludes held landing entries even if a published CMS row exists", () => {
    const paths = ["/uae-visa", "/dubai-visa", "/ar/uae-visa", "/apply", "/guides/how-to-apply"];
    expect(paths.filter(path => !isHeldPublicPage(path))).toEqual(["/apply", "/guides/how-to-apply"]);
  });
});
