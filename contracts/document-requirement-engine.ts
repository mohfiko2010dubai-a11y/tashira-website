import { z } from "zod";
import data from "./document-requirement-rules.json";

export const tripPurposeSchema = z.enum(["tourism", "visiting_family", "transit"]);
export type TripPurpose = z.infer<typeof tripPurposeSchema>;
export const documentRuleSchema = z.object({
  key: z.string().min(1), code: z.string().min(1), label_en: z.string().min(1), label_ar: z.string().min(1),
  hint_en: z.string(), hint_ar: z.string(), document_type: z.string().min(1),
  status: z.enum(["approved", "draft"]), placeholder: z.boolean().default(false),
  applies_when: z.object({ nationality: z.array(z.string().length(2)).optional(), country_of_residence: z.array(z.string().length(2)).optional(),
    visa_type: z.array(z.string()).optional(), visa_category: z.array(z.enum(["visit", "transit"])).optional(),
    trip_purpose: z.array(tripPurposeSchema).optional(), residence_region: z.enum(["gcc", "non_gcc"]).optional() }).strict(),
}).strict().refine(rule => !rule.placeholder || rule.status === "draft", "Resolve placeholder wording before approval");
export type DocumentRequirementRule = z.infer<typeof documentRuleSchema>;
export const DOCUMENT_REQUIREMENT_RULES = z.array(documentRuleSchema).parse(data);
export type DocumentRequirementContext = { nationality?: string | null; country_of_residence?: string | null; visa_type: string; trip_purpose?: TripPurpose | null };
export const GCC_COUNTRIES = ["SA", "KW", "BH", "QA", "OM", "AE"] as const;

export function requiredDocuments(context: DocumentRequirementContext, options: { previewDrafts?: boolean; rules?: readonly DocumentRequirementRule[] } = {}): DocumentRequirementRule[] {
  const category = /transit|96hours/i.test(context.visa_type) ? "transit" : "visit";
  const residence = context.country_of_residence?.toUpperCase();
  const nationality = context.nationality?.toUpperCase();
  const isGcc = GCC_COUNTRIES.some(code => code === residence);
  const selected = new Map<string, DocumentRequirementRule>();
  for (const rule of options.rules ?? DOCUMENT_REQUIREMENT_RULES) {
    if (rule.status !== "approved" && !options.previewDrafts) continue;
    const when = rule.applies_when;
    if (when.nationality && !when.nationality.includes(nationality ?? "")) continue;
    if (when.country_of_residence && !when.country_of_residence.includes(residence ?? "")) continue;
    if (when.visa_type && !when.visa_type.includes(context.visa_type)) continue;
    if (when.visa_category && !when.visa_category.includes(category)) continue;
    if (when.trip_purpose && !when.trip_purpose.includes(context.trip_purpose ?? (category === "transit" ? "transit" : "tourism"))) continue;
    if (when.residence_region && (!residence || (when.residence_region === "gcc") !== isGcc)) continue;
    const existing = selected.get(rule.key);
    if (!existing || (existing.status === "draft" && rule.status === "approved")) selected.set(rule.key, rule);
  }
  return [...selected.values()];
}
