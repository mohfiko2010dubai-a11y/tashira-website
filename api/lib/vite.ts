import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "node:fs";
import path from "node:path";
import { fixedMetadata, isPublicPage } from "../../contracts/ssr-pages";
import { renderPageTemplate, notFoundHtml } from "./ssr-html";
import { renderSsrResponse, SsrPageNotFound } from "./ssr-response";
import { renderInWorker, type RenderTiming } from "./ssr-worker";
import { languagePath, languageRoute, preferredLanguage } from "../../contracts/language-routes";
import { verifyAdminSessionAsync } from "./admin-session";
import { withSsrDeadline } from "./ssr-deadline";

type App = Hono<{ Bindings: HttpBindings }>;
export function getFrontendCacheControl(requestPath: string): string {
  return /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|jpe?g|webp|svg)$/.test(requestPath)
    ? "public, max-age=31536000, immutable" : "private, no-store";
}
export function serveStaticFiles(app: App) {
  const distPath = path.resolve(process.cwd(), "dist/public");
  app.use("*", async (c, next) => {
    if (/^\/(api|storage|invoices)\//.test(c.req.path)) return next();
    c.header("Cache-Control", getFrontendCacheControl(c.req.path));
    const route = languageRoute(c.req.path);
    const pathname = route.pathname;
    if (pathname === "/recover") c.header("Referrer-Policy", "no-referrer");
    if (pathname === "/recover" || pathname === "/login") c.header("X-Robots-Tag", "noindex, nofollow");
    const requestUrl = new URL(c.req.url);
    if (!route.prefixed && (isPublicPage(pathname) || /^\/(apply\/|pay\/|applications\/|deposit\/|recover$)/.test(pathname))) {
      c.header("Vary", "Accept-Language");
      return c.redirect(languagePath(pathname, preferredLanguage(c.req.header("Accept-Language") ?? "")) + requestUrl.search, 302);
    }
    const privatePage = pathname === "/apply" || pathname === "/track" || /[?&](?:ref|token|referenceNumber)=/.test(requestUrl.search);
    if (isPublicPage(pathname) && (c.req.method === "GET" || c.req.method === "HEAD")) {
      const template = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
      const meta = fixedMetadata(pathname, route.language);
      let fault: string | undefined;
      const wanted = requestUrl.searchParams.get("__ssr_test");
      if (process.env.PUBLIC_APP_URL?.replace(/\/$/, "") === "https://staging.tashiraev.com" &&
          ["render-error", "render-timeout", "data-timeout"].includes(wanted ?? "")) {
        const allowed = await withSsrDeadline(() => verifyAdminSessionAsync(c.req.raw.headers), { stage: "data" }).catch(() => false);
        if (allowed) fault = wanted!;
      }
      // Reference-bearing pages stay client-only; no private query state enters SSR HTML.
      if (pathname === "/track" && requestUrl.searchParams.has("ref")) {
        c.header("X-Robots-Tag", "noindex");
        return c.html(renderPageTemplate(template, meta));
      }
      const started = performance.now();
      let timing: RenderTiming | undefined;
      const response = await renderSsrResponse({ language: route.language, routeTemplate: meta ? pathname : "/:section/:slug", noindex: privatePage,
        shellHtml: renderPageTemplate(template, meta),
        render: async signal => {
          const result = await renderInWorker({ url: c.req.path + requestUrl.search, apiOrigin: `http://127.0.0.1:${process.env.PORT || "3000"}`, fault }, signal);
          if (result.notFound) {
            if (meta) throw new Error("Fixed public page data unavailable");
            throw new SsrPageNotFound();
          }
          if (!result.html.trim()) throw new Error("Empty rendered body");
          timing = result.timing;
          return renderPageTemplate(template, result.meta, { html: result.html, state: result.state });
        },
      });
      const elapsedMs = performance.now() - started;
      response.headers.set("Server-Timing", `ssr;dur=${elapsedMs.toFixed(1)}`);
      console.info(JSON.stringify({ event: "ssr_render", route: meta ? pathname : "/:section/:slug", language: route.language, elapsedMs: Math.round(elapsedMs), mode: response.headers.get("X-Tashira-SSR"), ...(timing ? { ...timing, otherMs: elapsedMs - timing.dataWallMs - timing.reactMs - timing.serializationMs } : {}) }));
      return response;
    }
    if (/^\/(apply\/|pay\/|applications\/|deposit\/|recover$|login$|dashboard$|admin(?:\/|$)|staff(?:\/|$))/.test(pathname)) {
      c.header("X-Robots-Tag", "noindex, nofollow");
      return c.html(renderPageTemplate(fs.readFileSync(path.join(distPath, "index.html"), "utf8"), null, undefined, route.language));
    }
    return serveStatic({ root: distPath })(c, next);
  });
  app.notFound(c => {
    if (c.req.path.startsWith("/api/")) return c.json({ error: "Not Found" }, 404);
    c.header("Cache-Control", "private, no-store");
    c.header("X-Robots-Tag", "noindex, nofollow");
    return c.html(notFoundHtml(languageRoute(c.req.path).language), 404);
  });
}
