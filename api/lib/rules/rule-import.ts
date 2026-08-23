import { z } from "zod";

export const ruleClassificationSchema = z.enum(["OFFICIAL", "OPERATIONAL", "CONDITIONAL", "INTERNAL"]);
export const ruleResearchStatusSchema = z.enum(["VALIDATED", "NOT_RESEARCHED", "MANUAL_REVIEW_REQUIRED"]);
export const ruleLayerSchema = z.enum([
  "BASE_ROUTE", "NATIONALITY_OVERLAY", "RESIDENCE_OVERLAY", "GCC_OVERLAY",
  "AGE_MINOR_OVERLAY", "FAMILY_OVERLAY", "OPERATIONAL_OVERLAY",
]);

const sourceSchema = z.object({
  authority: z.string().min(1).max(255),
  title: z.string().min(1).max(500),
  url: z.string().url().refine((url) => new URL(url).protocol === "https:", "Source URL must use HTTPS"),
  retrievedAt: z.string().datetime({ offset: true }),
  fingerprintSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const conditionSchema = z.object({
  field: z.string().min(1).max(100),
  operator: z.enum(["EQUALS", "IN", "NOT_IN", "EXISTS"]),
  value: z.union([z.string(), z.array(z.string())]).optional(),
});

export const visaRuleImportSchema = z.object({
  stableId: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,79}$/),
  version: z.number().int().positive(),
  status: z.literal("DRAFT"),
  classification: ruleClassificationSchema,
  layer: ruleLayerSchema,
  researchStatus: ruleResearchStatusSchema,
  routeCode: z.string().min(1).max(80),
  profileCode: z.string().min(1).max(80),
  effectiveFrom: z.string().datetime({ offset: true }),
  effectiveTo: z.string().datetime({ offset: true }).nullable(),
  source: sourceSchema,
  conditions: z.array(conditionSchema),
  outcome: z.object({
    eligibility: z.enum(["NO_CHANGE", "ELIGIBLE", "INELIGIBLE", "HUMAN_REVIEW_REQUIRED"]),
    requirementCodes: z.array(z.string().min(1).max(80)),
    conditionalDocuments: z.array(z.object({
      code: z.string().min(1).max(80),
      reason: z.string().min(1).max(500),
    })).default([]),
    explanationCode: z.string().min(1).max(100),
  }),
}).superRefine((rule, context) => {
  if (rule.effectiveTo && Date.parse(rule.effectiveTo) <= Date.parse(rule.effectiveFrom)) {
    context.addIssue({ code: "custom", path: ["effectiveTo"], message: "effectiveTo must be after effectiveFrom" });
  }
  if (rule.researchStatus !== "VALIDATED" && rule.outcome.eligibility !== "HUMAN_REVIEW_REQUIRED") {
    context.addIssue({
      code: "custom",
      path: ["outcome", "eligibility"],
      message: "Unvalidated research must require human review",
    });
  }
  if (rule.classification !== "OFFICIAL" && rule.outcome.eligibility !== "NO_CHANGE") {
    context.addIssue({
      code: "custom",
      path: ["outcome", "eligibility"],
      message: "Only OFFICIAL rules may decide eligibility",
    });
  }
});

export type VisaRuleImport = z.infer<typeof visaRuleImportSchema>;

export function validateVisaRuleImport(value: unknown): VisaRuleImport {
  return visaRuleImportSchema.parse(value);
}
