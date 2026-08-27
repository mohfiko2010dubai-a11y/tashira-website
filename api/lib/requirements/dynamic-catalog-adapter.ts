import type { RequirementCatalog } from "./dynamic-requirements";
import { customerReason, type VersionedRequirementCatalog } from "./requirement-catalog";

const classification = {
  OFFICIAL: "AUTHORITY_REQUIRED",
  OPERATIONAL: "TASHIRA_PROCESSING",
  CONDITIONAL: "MAY_BE_REQUIRED",
  OPTIONAL: "OPTIONAL",
} as const;

/** Converts governed catalog evidence into the customer runtime contract. INTERNAL definitions are never projected. */
export function toDynamicRequirementCatalog(catalog: VersionedRequirementCatalog): RequirementCatalog {
  return {
    version: catalog.catalogVersion,
    documents: catalog.requirements.filter((definition) => definition.classification !== "INTERNAL").map((definition) => ({
      code: definition.code,
      label: definition.customerLabel,
      category: definition.category,
      classification: classification[definition.classification as keyof typeof classification],
      definitionId: definition.definitionId,
      definitionVersion: definition.version,
      shortCustomerExplanation: definition.shortCustomerExplanation,
      reasonTemplate: customerReason(definition),
      sharingScope: definition.familyScopedCapability ? "FAMILY"
        : definition.travelGroupScopedCapability ? "TRAVEL_GROUP" : "APPLICANT",
    })),
    questions: catalog.questions.filter((definition) => definition.classification !== "INTERNAL" && definition.customerVisible)
      .map((definition) => ({
        code: definition.code,
        prompt: definition.customerLabel,
        answerType: definition.answerType === "BOOLEAN" || definition.answerType === "SELECT" || definition.answerType === "TEXT"
          ? definition.answerType : "TEXT",
        options: definition.allowedValues ?? undefined,
        definitionId: definition.definitionId,
        definitionVersion: definition.version,
        helpText: definition.helpText,
      })),
  };
}
