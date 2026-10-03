import { z } from "zod";

export const nationalityProductRule = z.object({
  nationality: z.string().regex(/^[A-Z]{2}$/),
  product: z.string().min(1).max(80),
  from: z.string().datetime(),
  until: z.string().datetime().nullable(),
}).refine(rule => !rule.until || rule.until > rule.from, "End must be after start");
export const nationalityProductRules = z.array(nationalityProductRule).max(1000);
export type NationalityProductRule = z.infer<typeof nationalityProductRule>;

export function blockedProductNationalities(rules: readonly NationalityProductRule[], product: string,
  nationalities: readonly (string | null | undefined)[], at: Date): string[] {
  const time = at.getTime();
  return [...new Set(nationalities.filter((nationality): nationality is string => Boolean(nationality && rules.some(rule =>
    rule.nationality === nationality && (rule.product === "*" || rule.product === product)
    && Date.parse(rule.from) <= time && (!rule.until || time < Date.parse(rule.until))))))];
}
