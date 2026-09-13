import metadata from "./public-page-metadata.json";

export type FixedPath = keyof typeof metadata;
export type PageMetadata = { title: string; description: string; canonicalPath: string; image?: string | null };
export function fixedMetadata(path: string, language = "en"): PageMetadata | null {
  const page = Object.hasOwn(metadata, path) ? metadata[path as FixedPath] : null;
  return page ? { ...page[language.startsWith("ar") ? "ar" : "en"], canonicalPath: path } : null;
}
export function isPublicPage(path: string): boolean {
  return Boolean(fixedMetadata(path)) || /^\/(guides|news|uae-visa)\/[^/]+$/.test(path);
}
export function articleMetadata(article: { title: string; excerpt?: string | null; heroImage?: string | null }, path: string): PageMetadata {
  return { title: `${article.title} | TASHIRA`, description: (article.excerpt ?? "").trim().slice(0, 155), canonicalPath: path, image: article.heroImage };
}
