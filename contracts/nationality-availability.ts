import { NATIONALITY_CATALOG } from "../api/lib/requirements/nationality-catalog";

export function unavailableNationalities(codes: readonly string[], nationalities: readonly (string | null | undefined)[]) {
  const restricted = new Set(codes);
  return [...new Set(nationalities.filter((code): code is string => Boolean(code && restricted.has(code))))];
}
export function nationalityUnavailableCopy(codes: readonly string[], ar: boolean) {
  const names = codes.map(code => {
    const country = NATIONALITY_CATALOG.find(item => item.code === code);
    return country ? ar ? country.nameAr : country.nameEn : code;
  }).join(ar ? "، " : ", ");
  return ar ? `التقديم غير متاح حاليًا لمواطني ${names}. تواصل معنا للمساعدة.` : `Applications are not currently available for nationals of ${names}. Contact us for assistance.`;
}
