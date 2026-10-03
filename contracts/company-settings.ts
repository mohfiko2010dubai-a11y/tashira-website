export const COMPANY_FIELDS = ["legalName", "address", "licence", "email", "phone", "website", "logo"] as const;
export type CompanyField = typeof COMPANY_FIELDS[number];
export type CompanyIdentity = Record<CompanyField, string | null>;

export function companyReopeningBlockers(settings: CompanyIdentity & { provisionalFieldsJson: string | null }): string[] {
  let provisional: unknown;
  try { provisional = JSON.parse(settings.provisionalFieldsJson ?? "null"); } catch { provisional = null; }
  if (!Array.isArray(provisional) || provisional.some(field => !COMPANY_FIELDS.includes(field))) {
    return ["Cannot reopen: company provisional-field review is incomplete."];
  }
  return COMPANY_FIELDS.flatMap(field => !settings[field]?.trim()
    ? [`Cannot reopen: company ${field} is missing.`]
    : provisional.includes(field) ? [`Cannot reopen: company ${field} is still provisional.`] : []);
}
