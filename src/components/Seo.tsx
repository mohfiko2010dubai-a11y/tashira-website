import { useLocation } from "react-router-dom";
import { fixedMetadata } from "@contracts/ssr-pages";
import PageHead from "./PageHead";
import { useEffect } from "react";

interface SeoProps {
  title: string;
  description?: string | null;
  canonicalPath: string;
  robots?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  /** Absolute alternates per locale, e.g. { en: '/uae-visa', ar: '/uae-visa' } */
  alternates?: { en?: string; ar?: string };
  jsonLd?: Record<string, unknown> | null;
  lang: string;
}

export default function Seo({ title, description, canonicalPath, robots, ogTitle, ogDescription, ogImage, alternates, jsonLd, lang }: SeoProps) {
  const location = useLocation();
  const fixed = Boolean(fixedMetadata(location.pathname));
  useEffect(() => {
    if (fixed) return;
    const tags: HTMLElement[] = [];
    const append = (tag: HTMLElement) => { document.head.append(tag); tags.push(tag); };
    for (const [property, content] of Object.entries({
      "og:title": ogTitle || title, "og:description": ogDescription || description,
      "og:url": `https://www.tashiraev.com${canonicalPath}`, "og:type": "article",
      "og:image": ogImage, "og:locale": lang === "ar" ? "ar_AE" : "en_AE",
    })) {
      if (!content) continue;
      const tag = document.createElement("meta"); tag.setAttribute("property", property); tag.content = content; append(tag);
    }
    for (const [language, path] of Object.entries({ ...alternates, "x-default": alternates?.en || canonicalPath })) {
      if (!path) continue;
      const tag = document.createElement("link"); tag.rel = "alternate"; tag.hreflang = language; tag.href = `https://www.tashiraev.com${path}`; append(tag);
    }
    if (jsonLd) { const tag = document.createElement("script"); tag.type = "application/ld+json"; tag.textContent = JSON.stringify(jsonLd); append(tag); }
    return () => tags.forEach(tag => tag.remove());
  }, [fixed, title, description, canonicalPath, ogTitle, ogDescription, ogImage, alternates, jsonLd, lang]);
  if (fixed) return null;
  return <PageHead title={title} description={description ?? ""} canonicalPath={canonicalPath} robots={robots} />;
}
