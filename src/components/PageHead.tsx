import { fixedMetadata } from "@contracts/ssr-pages";
import { socialMetadata } from "@contracts/social-metadata";
import { useEffect } from "react";
import { languagePath } from "@contracts/language-routes";

/** Initial tags come from SSR. This synchronizes later client-side navigation. */
export default function PageHead({ title, description, canonicalPath, robots, alternates }: {
  title: string; description: string; canonicalPath: string; robots?: string | null; alternates?: { en?: string; ar?: string };
}) {
  useEffect(() => {
    const meta = fixedMetadata(canonicalPath);
    if (meta) for (const [key, value] of Object.entries(socialMetadata(meta, window.location.origin))) {
      const attribute = key.startsWith("twitter:") ? "name" : "property";
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (!tag) { tag = document.createElement("meta"); tag.setAttribute(attribute, key); document.head.append(tag); }
      tag.content = value;
    }
    document.title = title;
    let descriptionTag = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.name = "description";
      document.head.append(descriptionTag);
    }
    descriptionTag.content = description;
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = `https://www.tashiraev.com${canonicalPath}`;
    for (const language of ["en", "ar", "x-default"] as const) {
      let alternate = document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${language}"]`);
      if (!alternate) { alternate = document.createElement("link"); alternate.rel = "alternate"; alternate.hreflang = language; document.head.append(alternate); }
      const locale = language === "ar" ? "ar" : "en";
      alternate.href = `https://www.tashiraev.com${languagePath(alternates?.[locale] || canonicalPath, locale)}`;
    }
    if (robots) {
      let tag = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (!tag) { tag = document.createElement("meta"); tag.name = "robots"; document.head.append(tag); }
      tag.content = robots;
    } else {
      document.head.querySelector('meta[name="robots"]')?.remove();
    }
  }, [title, description, canonicalPath, robots, alternates]);
  return null;
}
