export type SiteLanguage = "en" | "ar";
export function languageRoute(pathname: string): { language: SiteLanguage; pathname: string; prefixed: boolean } {
  const match = /^\/(en|ar)(?=\/|$)/.exec(pathname);
  return { language: match?.[1] === "ar" ? "ar" : "en", pathname: match ? pathname.slice(match[0].length) || "/" : pathname, prefixed: Boolean(match) };
}
export function languagePath(pathname: string, language: SiteLanguage): string {
  const path = languageRoute(pathname).pathname;
  return `/${language}${path === "/" ? "" : path}`;
}
export function preferredLanguage(header: string): SiteLanguage {
  const choices = header.split(",").map((part, index) => {
    const [tag, ...parameters] = part.trim().toLowerCase().split(";");
    const q = parameters.find(value => value.trim().startsWith("q="));
    return { tag: tag.split("-")[0], weight: q ? Number(q.trim().slice(2)) : 1, index };
  }).filter(choice => Number.isFinite(choice.weight) && choice.weight > 0 && ["ar", "en"].includes(choice.tag))
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return choices[0]?.tag === "ar" ? "ar" : "en";
}
