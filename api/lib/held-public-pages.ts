import { notFoundHtml } from "./ssr-html";
import { languageRoute } from "../../contracts/language-routes";
import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";

// Owner hold: release only after real content exists in both languages.
export function isHeldPublicPage(pathname: string): boolean {
  const base = pathname.replace(/^\/(?:en|ar)(?=\/)/, "").replace(/\/+$/, "");
  return base === "/uae-visa" || base === "/dubai-visa";
}

export function registerHeldPublicPages(app: Hono<{ Bindings: HttpBindings }>): void {
  app.use("*", async (c, next) => {
    if (!isHeldPublicPage(c.req.path)) return next();
    c.header("Cache-Control", "private, no-store");
    c.header("X-Robots-Tag", "noindex, nofollow");
    return c.html(notFoundHtml(languageRoute(c.req.path).language), 404);
  });
}
