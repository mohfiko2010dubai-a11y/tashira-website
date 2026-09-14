import metadata from "./public-page-metadata.json";
import { languagePath, languageRoute, type SiteLanguage } from "./language-routes";

export type FixedPath = keyof typeof metadata;
export type PageMetadata = { title: string; description: string; canonicalPath: string; image?: string | null; language?: SiteLanguage };
export function fixedMetadata(path: string, language = "en"): PageMetadata | null {
  const route = languageRoute(path);
  const lang = route.prefixed ? route.language : language.startsWith("ar") ? "ar" : "en";
  const page = Object.hasOwn(metadata, route.pathname) ? metadata[route.pathname as FixedPath] : null;
  return page ? { ...page[lang], canonicalPath: languagePath(route.pathname, lang), image: `/og/${lang}/${route.pathname === "/" ? "home" : route.pathname.slice(1)}.jpg`, language: lang } : null;
}
export function isPublicPage(path: string): boolean {
  return Boolean(fixedMetadata(path)) || /^\/(guides|news|uae-visa)\/[^/]+$/.test(path);
}
export function articleMetadata(article: { title: string; excerpt?: string | null; heroImage?: string | null }, path: string, language: SiteLanguage = "en"): PageMetadata {
  return { title: `${article.title} | TASHIRA`, description: (article.excerpt ?? "").trim().slice(0, 155), canonicalPath: languagePath(path, language), image: article.heroImage, language };
}
