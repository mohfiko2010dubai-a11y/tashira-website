import metadata from "./public-page-metadata.json";
import { languagePath, languageRoute, type SiteLanguage } from "./language-routes";

export type FixedPath = keyof typeof metadata;
export type PageMetadata = { title: string; description: string; canonicalPath: string; image?: string | null; language?: SiteLanguage; layout?: "marketing" | "application" };
// Explicit layout registrations; a new page gets no atmosphere until it opts in.
const layouts: Record<FixedPath, "marketing" | "application"> = {
  "/": "marketing", "/visa-prices": "marketing", "/how-to-apply": "marketing",
  "/apply": "application", "/track": "application", "/guides": "marketing", "/news": "marketing",
  "/contact": "marketing", "/refund": "marketing", "/terms": "marketing", "/privacy": "marketing",
  "/cookies": "marketing", "/visa-pre-check": "marketing", "/about": "marketing",
  "/editorial-policy": "marketing", "/sources-and-verification": "marketing",
};
export function fixedMetadata(path: string, language = "en"): PageMetadata | null {
  const route = languageRoute(path);
  const lang = route.prefixed ? route.language : language.startsWith("ar") ? "ar" : "en";
  const page = Object.hasOwn(metadata, route.pathname) ? metadata[route.pathname as FixedPath] : null;
  return page ? { ...page[lang], layout: layouts[route.pathname as FixedPath], canonicalPath: languagePath(route.pathname, lang), image: `/og/${lang}/${route.pathname === "/" ? "home" : route.pathname.slice(1)}.jpg`, language: lang } : null;
}
export function isPublicPage(path: string): boolean {
  return Boolean(fixedMetadata(path)) || /^\/(guides|news|uae-visa)\/[^/]+$/.test(path);
}
export function articleMetadata(article: { title: string; excerpt?: string | null; heroImage?: string | null }, path: string, language: SiteLanguage = "en"): PageMetadata {
  return { layout: "marketing", title: `${article.title} | TASHIRA`, description: (article.excerpt ?? "").trim().slice(0, 155), canonicalPath: languagePath(path, language), image: article.heroImage, language };
}
