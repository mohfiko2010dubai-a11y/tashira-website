/**
 * RTL language detection for document direction and font selection.
 * Covers every RTL locale we ship resources for (Arabic base is reused for
 * Urdu, Persian and Hebrew — see src/i18n/index.ts).
 */
const RTL_LANGUAGES = ["ar", "ur", "fa", "he"] as const;

export function isRtlLanguage(language: string | undefined | null): boolean {
  if (!language) return false;
  const base = language.toLowerCase().split("-")[0];
  return (RTL_LANGUAGES as readonly string[]).includes(base);
}

export function documentDirection(language: string | undefined | null): "rtl" | "ltr" {
  return isRtlLanguage(language) ? "rtl" : "ltr";
}
