import { socialMetadata } from "../../contracts/social-metadata";
import type { PageMetadata } from "../../contracts/ssr-pages";
import { languagePath, type SiteLanguage } from "../../contracts/language-routes";

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export function renderPageTemplate(template: string, meta: PageMetadata | null, rendered?: { html: string; state: unknown }, language: SiteLanguage = meta?.language ?? "en"): string {
  const head = meta ? `<title>${escape(meta.title)}</title><meta name="description" content="${escape(meta.description)}"/><link rel="canonical" href="https://www.tashiraev.com${escape(meta.canonicalPath)}"/>` : "<title>TASHIRA</title>";
  const social = meta ? Object.entries(socialMetadata(meta, process.env.PUBLIC_APP_URL)).map(([key, value]) => `<meta ${key.startsWith("twitter:") ? "name" : "property"}="${key}" content="${escape(value)}"/>`).join("") : "";
  const state = rendered ? `<script id="__SSR_DATA" type="application/json">${JSON.stringify(rendered.state).replaceAll("<", "\\u003c")}</script>` : "";
  const alternates = meta ? (["en", "ar", "x-default"] as const).map(lang => `<link rel="alternate" hreflang="${lang}" href="https://www.tashiraev.com${escape(languagePath(meta.canonicalPath, lang === "ar" ? "ar" : "en"))}"/>`).join("") : "";
  return template.replace(/<html[^>]*>/, `<html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}">`)
    .replace("<!--PAGE_METADATA-->", head + alternates + social)
    .replace('<div id="root"></div>', rendered ? `<div id="root" data-ssr="true">${rendered.html}</div>${state}` : '<div id="root"><div style="padding:32px;text-align:center"><img src="/icons/mark-1024-transparent.png" width="64" height="64" alt="TASHIRA — UAE E-Visa Services"/></div></div>');
}
export const NOT_FOUND_HTML = '<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><link rel="icon" href="/favicon.ico"><link rel="icon" href="/icons/logo-mark-favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icons/icon-180.png"><link rel="manifest" href="/site.webmanifest"><meta name="theme-color" content="#0A1628"><title>Page not found | TASHIRA</title></head><body><main><img src="/icons/mark-1024-transparent.png" width="64" height="64" alt="TASHIRA — UAE E-Visa Services"><h1>Page not found</h1><a href="/">TASHIRA</a></main></body></html>';

export function notFoundHtml(language: "en" | "ar" = "en"): string {
  return language === "ar" ? NOT_FOUND_HTML.replaceAll("Page not found", "الصفحة غير موجودة").replace('lang="en" dir="ltr"', 'lang="ar" dir="rtl"').replace('href="/"', 'href="/ar"') : NOT_FOUND_HTML.replace('href="/"', 'href="/en"');
}
