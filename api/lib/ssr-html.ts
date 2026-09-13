import type { PageMetadata } from "../../contracts/ssr-pages";

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export function renderPageTemplate(template: string, meta: PageMetadata | null, rendered?: { html: string; state: unknown }): string {
  const head = meta ? `<title>${escape(meta.title)}</title><meta name="description" content="${escape(meta.description)}"/><link rel="canonical" href="https://www.tashiraev.com${escape(meta.canonicalPath)}"/>` : "<title>TASHIRA</title>";
  const state = rendered ? `<script id="__SSR_DATA" type="application/json">${JSON.stringify(rendered.state).replaceAll("<", "\\u003c")}</script>` : "";
  return template.replace(/<html[^>]*>/, '<html lang="en" dir="ltr">')
    .replace("<!--PAGE_METADATA-->", head)
    .replace('<div id="root"></div>', rendered ? `<div id="root" data-ssr="true">${rendered.html}</div>${state}` : '<div id="root"></div>');
}
export const NOT_FOUND_HTML = '<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><title>Page not found | TASHIRA</title></head><body><main><h1>Page not found</h1><a href="/">TASHIRA</a></main></body></html>';
