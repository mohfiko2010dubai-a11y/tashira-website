import { createHash } from "node:crypto";
import { z } from "zod";
import { questionDefinitionSchema, requirementDefinitionSchema } from "./requirement-catalog";

export const requirementCatalogImportSchema = z.object({
  importVersion: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,99}$/),
  requirements: z.array(requirementDefinitionSchema),
  questions: z.array(questionDefinitionSchema),
}).strict().superRefine((value, context) => {
  for (const [kind, definitions] of [["requirement", value.requirements], ["question", value.questions]] as const) {
    const identities = definitions.map(({ code, version }) => `${code}:${version}`);
    if (new Set(identities).size !== identities.length) context.addIssue({ code: "custom", message: `Duplicate ${kind} version` });
  }
});

export type RequirementCatalogImport = z.infer<typeof requirementCatalogImportSchema>;

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, normalize(entry)]));
  return value;
}

export function validateCatalogImport(input: unknown): { catalog: RequirementCatalogImport; sha256: string } {
  const catalog = requirementCatalogImportSchema.parse(input);
  const sha256 = createHash("sha256").update(JSON.stringify(normalize(catalog))).digest("hex");
  return { catalog, sha256 };
}

export const GENERIC_REQUIREMENT_CODES = [
  "PASSPORT", "PERSONAL_PHOTO", "NATIONAL_ID", "GCC_RESIDENCE", "RESIDENCE_PERMIT",
  "RETURN_TICKET", "OUTBOUND_TICKET", "ONWARD_TICKET", "ROUND_TRIP_TICKET", "FAMILY_BOOKING",
  "HEALTH_INSURANCE", "BANK_STATEMENT", "RELATIONSHIP_DOCUMENT",
] as const;

export const GENERIC_QUESTION_CODES = [
  "APPLICATION_TYPE", "NATIONALITY", "PASSPORT_COUNTRY", "RESIDENCE_COUNTRY", "RESIDENCE_TYPE", "GCC_RESIDENT",
  "GCC_COUNTRY", "RESIDENCE_EXPIRY", "PROFESSION", "DATE_OF_BIRTH", "RELATIONSHIP", "INSIDE_OUTSIDE_UAE",
  "TRAVELLING_TOGETHER", "ACCOMPANYING_PERSON", "PLANNED_ARRIVAL_DATE", "PLANNED_DEPARTURE_DATE",
  "HAS_CONFIRMED_TICKETS", "TRAVEL_GROUP",
] as const;

const labels: Readonly<Record<(typeof GENERIC_REQUIREMENT_CODES)[number], string>> = {
  PASSPORT: "Passport copy", PERSONAL_PHOTO: "Personal photo", NATIONAL_ID: "National ID",
  GCC_RESIDENCE: "GCC residence evidence", RESIDENCE_PERMIT: "Residence permit", RETURN_TICKET: "Return ticket",
  OUTBOUND_TICKET: "Outbound ticket", ONWARD_TICKET: "Onward ticket", ROUND_TRIP_TICKET: "Round-trip ticket", FAMILY_BOOKING: "Family booking",
  HEALTH_INSURANCE: "Health insurance", BANK_STATEMENT: "Bank statement", RELATIONSHIP_DOCUMENT: "Relationship document",
};

/** Safe generic DRAFT seed. It defines presentation only and activates no customer requirement. */
export function buildGenericCatalogSeed(): RequirementCatalogImport {
  const effectiveFrom = new Date("2026-01-01T00:00:00.000Z");
  return requirementCatalogImportSchema.parse({
    importVersion: "generic-requirement-catalog-v1",
    requirements: GENERIC_REQUIREMENT_CODES.map((code, index) => ({
      kind: "DOCUMENT", definitionId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      code, version: 1, status: "DRAFT", documentType: code, customerLabel: labels[code],
      shortCustomerExplanation: `Provide ${labels[code].toLowerCase()} when it is listed for your application.`,
      internalLabel: labels[code], classification: code === "PASSPORT" || code === "PERSONAL_PHOTO" ? "OFFICIAL" : "CONDITIONAL",
      authoritySemantics: null, reasonTemplate: code === "PASSPORT" || code === "PERSONAL_PHOTO"
        ? "Required by the relevant authority for this visa route." : "May be required depending on your case.",
      category: code === "PASSPORT" || code === "NATIONAL_ID" || code === "PERSONAL_PHOTO" ? "IDENTITY"
        : code.includes("TICKET") || code === "FAMILY_BOOKING" ? "TRAVEL"
          : code === "RELATIONSHIP_DOCUMENT" ? "RELATIONSHIP" : code.includes("RESIDENCE") ? "RESIDENCE" : "SUPPORTING",
      requiredCapability: true, conditionalCapability: true,
      sharedDocumentCapability: code.includes("TICKET") || code === "FAMILY_BOOKING" || code === "RELATIONSHIP_DOCUMENT",
      applicantScopedCapability: true, travelGroupScopedCapability: code.includes("TICKET") || code === "FAMILY_BOOKING",
      familyScopedCapability: code === "FAMILY_BOOKING" || code === "RELATIONSHIP_DOCUMENT",
      aiExtractionCapability: ["PASSPORT", "NATIONAL_ID", "GCC_RESIDENCE", "RESIDENCE_PERMIT"].includes(code),
      humanReviewPolicy: "ON_WARNING", effectiveFrom, effectiveTo: null, reviewStatus: "PENDING",
    })),
    questions: GENERIC_QUESTION_CODES.map((code, index) => ({
      kind: "QUESTION", definitionId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      code, version: 1, status: "DRAFT", questionType: code, customerLabel: code.split("_").map((part) => `${part[0]}${part.slice(1).toLowerCase()}`).join(" "),
      shortCustomerExplanation: "This answer is used only when an active rule needs it.", internalLabel: code,
      classification: "CONDITIONAL", authoritySemantics: null, reasonTemplate: "May be required depending on your case.",
      helpText: "Answer for this applicant or travel group only.",
      answerType: ["PLANNED_ARRIVAL_DATE", "PLANNED_DEPARTURE_DATE", "RESIDENCE_EXPIRY", "DATE_OF_BIRTH"].includes(code) ? "DATE"
        : ["GCC_RESIDENT", "TRAVELLING_TOGETHER", "HAS_CONFIRMED_TICKETS"].includes(code) ? "BOOLEAN" : "TEXT",
      allowedValues: null, validationContract: { maxLength: 200 }, customerVisible: true,
      effectiveFrom, effectiveTo: null, reviewStatus: "PENDING",
    })),
  });
}
