import { useEffect } from "react";

/** Initial tags come from SSR. This synchronizes later client-side navigation. */
export default function PageHead({ title, description, canonicalPath, robots }: {
  title: string; description: string; canonicalPath: string; robots?: string | null;
}) {
  useEffect(() => {
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
    if (robots) {
      let tag = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (!tag) { tag = document.createElement("meta"); tag.name = "robots"; document.head.append(tag); }
      tag.content = robots;
    } else {
      document.head.querySelector('meta[name="robots"]')?.remove();
    }
  }, [title, description, canonicalPath, robots]);
  return null;
}
