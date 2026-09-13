import { z } from "zod";
import data from "./document-requirement-rules.json";

export const tripPurposeSchema = z.enum(["tourism", "visiting_family", "transit"]);
export type TripPurpose = z.infer<typeof tripPurposeSchema>;
const conditions = z.object({ nationality: z.array(z.string().length(2)).optional(), country_of_residence: z.array(z.string().length(2)).optional(),
  visa_type: z.array(z.string()).optional(), visa_category: z.array(z.enum(["visit", "transit"])).optional(),
  trip_purpose: z.array(tripPurposeSchema).optional(), residence_region: z.enum(["gcc", "non_gcc"]).optional() }).strict();
export type DocumentRequirementRule = { key: string; code: string; label_en: string; label_ar: string; hint_en: string; hint_ar: string;
  document_type: string; status: "approved" | "draft"; placeholder?: boolean; applies_when: z.infer<typeof conditions>;
  any_of?: DocumentRequirementRule[]; all_of?: DocumentRequirementRule[]; legacy_codes?: string[]; distinct_from?: string[] };
export const documentRuleSchema: z.ZodType<DocumentRequirementRule> = z.lazy(() => z.object({
  key: z.string().min(1), code: z.string().min(1), label_en: z.string().min(1), label_ar: z.string().min(1),
  hint_en: z.string(), hint_ar: z.string(), document_type: z.string().min(1),
  status: z.enum(["approved", "draft"]), placeholder: z.boolean().optional(), applies_when: conditions,
  any_of: z.array(documentRuleSchema).min(1).optional(), all_of: z.array(documentRuleSchema).min(1).optional(),
  legacy_codes: z.array(z.string()).optional(), distinct_from: z.array(z.string()).optional(),
}).strict().refine(rule => !rule.placeholder || rule.status === "draft", "Resolve placeholder wording before approval")
  .refine(rule => !(rule.any_of && rule.all_of), "Use either any_of or all_of"));
export const DOCUMENT_REQUIREMENT_RULES = z.array(documentRuleSchema).parse(data);
export type DocumentRequirementContext = { nationality?: string | null; country_of_residence?: string | null; visa_type: string; trip_purpose?: TripPurpose | null };
export const GCC_COUNTRIES = ["SA", "KW", "BH", "QA", "OM", "AE"] as const;
export const flattenDocumentRules = (rules: readonly DocumentRequirementRule[]): DocumentRequirementRule[] => rules.flatMap(rule => [rule, ...flattenDocumentRules(rule.any_of ?? rule.all_of ?? [])]);
export type RuleDiagnostic = { key: string; reason: "draft" | "unmatched_condition" | "duplicate_key"; conditions?: string[] };

export function evaluateDocumentRequirements(context: DocumentRequirementContext, options: { previewDrafts?: boolean; rules?: readonly DocumentRequirementRule[] } = {}) {
  const category = /transit|96hours/i.test(context.visa_type) ? "transit" : "visit";
  const residence = context.country_of_residence?.toUpperCase();
  const nationality = context.nationality?.toUpperCase();
  const isGcc = GCC_COUNTRIES.some(code => code === residence);
  const selected = new Map<string, DocumentRequirementRule>();
  const suppressed: RuleDiagnostic[] = []; const unmatched: RuleDiagnostic[] = [];
  const select = (rule: DocumentRequirementRule): DocumentRequirementRule | null => {
    const when = rule.applies_when; const missed: string[] = [];
    if (when.nationality && !when.nationality.includes(nationality ?? "")) missed.push("nationality");
    if (when.country_of_residence && !when.country_of_residence.includes(residence ?? "")) missed.push("country_of_residence");
    if (when.visa_type && !when.visa_type.includes(context.visa_type)) missed.push("visa_type");
    if (when.visa_category && !when.visa_category.includes(category)) missed.push("visa_category");
    if (when.trip_purpose && !when.trip_purpose.includes(context.trip_purpose ?? (category === "transit" ? "transit" : "tourism"))) missed.push("trip_purpose");
    if (when.residence_region && (!residence || (when.residence_region === "gcc") !== isGcc)) missed.push("residence_region");
    if (missed.length) { unmatched.push({ key: rule.key, reason: "unmatched_condition", conditions: missed }); return null; }
    if (rule.status === "draft") { suppressed.push({ key: rule.key, reason: "draft" }); if (!options.previewDrafts) return null; }
    const children = rule.any_of ?? rule.all_of;
    if (!children) return rule;
    const published = children.map(select).filter((child): child is DocumentRequirementRule => child !== null);
    if (!published.length) return null;
    return { ...rule, ...(rule.any_of ? { any_of: published } : { all_of: published }) };
  };
  for (const rule of options.rules ?? DOCUMENT_REQUIREMENT_RULES) {
    const published = select(rule); if (!published) continue;
    if (selected.has(rule.key)) { suppressed.push({ key: rule.key, reason: "duplicate_key" }); continue; }
    selected.set(rule.key, published);
  }
  return { requirements: [...selected.values()], suppressed, unmatched };
}
export function requiredDocuments(context: DocumentRequirementContext, options: { previewDrafts?: boolean; rules?: readonly DocumentRequirementRule[] } = {}): DocumentRequirementRule[] {
  return evaluateDocumentRequirements(context, options).requirements;
}
export function documentLeaves(rule: DocumentRequirementRule): DocumentRequirementRule[] {
  return rule.any_of || rule.all_of ? (rule.any_of ?? rule.all_of ?? []).flatMap(documentLeaves) : [rule];
}
export function requirementSatisfied(rule: DocumentRequirementRule, uploaded: ReadonlySet<string>): boolean {
  if (rule.legacy_codes?.some(code => uploaded.has(code))) return true;
  if (rule.any_of) return rule.any_of.some(child => requirementSatisfied(child, uploaded));
  if (rule.all_of) return rule.all_of.every(child => requirementSatisfied(child, uploaded));
  return uploaded.has(rule.code);
}
export function satisfiedRequirementCodes(rules: readonly DocumentRequirementRule[], uploaded: ReadonlySet<string>): string[] {
  return rules.filter(rule => requirementSatisfied(rule, uploaded)).map(rule => rule.code);
}
