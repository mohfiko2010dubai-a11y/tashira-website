import { z } from "zod";

export const requirementClassificationSchema = z.enum(["OFFICIAL", "OPERATIONAL", "CONDITIONAL", "OPTIONAL", "INTERNAL"]);
export const catalogLifecycleSchema = z.enum(["DRAFT", "ACTIVE", "RETIRED"]);
export const catalogReviewSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

const baseDefinitionSchema = z.object({
  definitionId: z.string().uuid(),
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,99}$/),
  version: z.number().int().positive(),
  status: catalogLifecycleSchema,
  customerLabel: z.string().min(1).max(200),
  shortCustomerExplanation: z.string().min(1).max(500),
  internalLabel: z.string().min(1).max(200),
  classification: requirementClassificationSchema,
  authoritySemantics: z.string().max(500).nullable(),
  reasonTemplate: z.string().min(1).max(500),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable(),
  reviewStatus: catalogReviewSchema,
}).strict();

export const requirementDefinitionSchema = baseDefinitionSchema.extend({
  kind: z.literal("DOCUMENT"),
  documentType: z.string().min(1).max(100),
  category: z.enum(["IDENTITY", "TRAVEL", "RELATIONSHIP", "RESIDENCE", "SUPPORTING"]),
  requiredCapability: z.boolean(),
  conditionalCapability: z.boolean(),
  sharedDocumentCapability: z.boolean(),
  applicantScopedCapability: z.boolean(),
  travelGroupScopedCapability: z.boolean(),
  familyScopedCapability: z.boolean(),
  aiExtractionCapability: z.boolean(),
  humanReviewPolicy: z.enum(["ALWAYS", "ON_WARNING", "ON_MISMATCH", "NOT_REQUIRED"]),
}).strict();

export const questionDefinitionSchema = baseDefinitionSchema.extend({
  kind: z.literal("QUESTION"),
  questionType: z.string().min(1).max(100),
  helpText: z.string().max(500),
  answerType: z.enum(["BOOLEAN", "SELECT", "TEXT", "DATE", "NUMBER"]),
  allowedValues: z.array(z.string().min(1).max(200)).nullable(),
  validationContract: z.record(z.string(), z.unknown()),
  customerVisible: z.boolean(),
}).strict();

export type RequirementCatalogDefinition = z.infer<typeof requirementDefinitionSchema>;
export type QuestionCatalogDefinition = z.infer<typeof questionDefinitionSchema>;

export type VersionedRequirementCatalog = {
  catalogVersion: string;
  requirements: readonly RequirementCatalogDefinition[];
  questions: readonly QuestionCatalogDefinition[];
};

export function isDefinitionEffective(definition: { effectiveFrom: Date; effectiveTo: Date | null }, at: Date): boolean {
  return definition.effectiveFrom.getTime() <= at.getTime()
    && (definition.effectiveTo === null || at.getTime() <= definition.effectiveTo.getTime());
}

export function customerReason(definition: RequirementCatalogDefinition): string {
  if (definition.classification === "OFFICIAL") return definition.reasonTemplate;
  if (definition.classification === "OPERATIONAL") return "Required for TASHIRA processing.";
  if (definition.classification === "CONDITIONAL") return "May be required depending on your case.";
  if (definition.classification === "OPTIONAL") return "Optional supporting evidence; it is not required for this application.";
  throw new Error("INTERNAL_REQUIREMENT_NOT_CUSTOMER_VISIBLE");
}

export type HistoricalRequirementReference = {
  definitionId: string | null;
  definitionVersion: number | null;
  requirementCode: string;
};

export function resolveHistoricalRequirement(
  reference: HistoricalRequirementReference,
  catalog: VersionedRequirementCatalog,
): RequirementCatalogDefinition | { code: string; customerLabel: "LEGACY_REQUIREMENT" } {
  const match = catalog.requirements.find((definition) => definition.definitionId === reference.definitionId
    && definition.version === reference.definitionVersion && definition.code === reference.requirementCode);
  return match ?? { code: reference.requirementCode, customerLabel: "LEGACY_REQUIREMENT" };
}
