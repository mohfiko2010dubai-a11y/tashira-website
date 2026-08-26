import type { OperationsSqlClient } from "../operations/mysql-access-provider";
import {
  isDefinitionEffective,
  questionDefinitionSchema,
  requirementDefinitionSchema,
  type VersionedRequirementCatalog,
} from "./requirement-catalog";

function value(row: object, key: string): unknown { return Reflect.get(row, key); }
function json(valueToParse: unknown): unknown {
  if (typeof valueToParse !== "string") return valueToParse;
  try { return JSON.parse(valueToParse) as unknown; } catch { return undefined; }
}
function date(valueToParse: unknown): Date | null {
  const parsed = valueToParse instanceof Date ? valueToParse : typeof valueToParse === "string" ? new Date(valueToParse) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}
function bool(valueToParse: unknown): boolean { return valueToParse === true || valueToParse === 1 || valueToParse === "1"; }

export class MysqlRequirementCatalogProvider {
  constructor(private readonly sql: OperationsSqlClient) {}

  async active(at: Date): Promise<VersionedRequirementCatalog> {
    const requirementRows = await this.sql.query(
      `SELECT id AS definitionId,stable_code AS code,version,status,document_type AS documentType,
              customer_label AS customerLabel,short_customer_explanation AS shortCustomerExplanation,
              internal_label AS internalLabel,classification,authority_semantics AS authoritySemantics,
              reason_template AS reasonTemplate,category,required_capability AS requiredCapability,
              conditional_capability AS conditionalCapability,shared_document_capability AS sharedDocumentCapability,
              applicant_scoped_capability AS applicantScopedCapability,travel_group_scoped_capability AS travelGroupScopedCapability,
              family_scoped_capability AS familyScopedCapability,ai_extraction_capability AS aiExtractionCapability,
              human_review_policy AS humanReviewPolicy,effective_from AS effectiveFrom,effective_to AS effectiveTo,
              review_status AS reviewStatus
         FROM requirement_definitions
        WHERE status='ACTIVE' AND review_status='APPROVED' AND effective_from<=?
          AND (effective_to IS NULL OR effective_to>=?)
        ORDER BY stable_code,version`, [at, at],
    );
    const questionRows = await this.sql.query(
      `SELECT id AS definitionId,stable_code AS code,version,status,question_type AS questionType,
              customer_label AS customerLabel,short_customer_explanation AS shortCustomerExplanation,
              internal_label AS internalLabel,classification,authority_semantics AS authoritySemantics,
              reason_template AS reasonTemplate,help_text AS helpText,answer_type AS answerType,
              allowed_values_json AS allowedValues,validation_contract_json AS validationContract,
              customer_visible AS customerVisible,effective_from AS effectiveFrom,effective_to AS effectiveTo,
              review_status AS reviewStatus
         FROM requirement_question_definitions
        WHERE status='ACTIVE' AND review_status='APPROVED' AND effective_from<=?
          AND (effective_to IS NULL OR effective_to>=?)
        ORDER BY stable_code,version`, [at, at],
    );
    const requirements = requirementRows.map((row) => requirementDefinitionSchema.parse({
      kind: "DOCUMENT", definitionId: value(row, "definitionId"), code: value(row, "code"),
      version: Number(value(row, "version")), status: value(row, "status"), documentType: value(row, "documentType"),
      customerLabel: value(row, "customerLabel"), shortCustomerExplanation: value(row, "shortCustomerExplanation"),
      internalLabel: value(row, "internalLabel"), classification: value(row, "classification"),
      authoritySemantics: value(row, "authoritySemantics"), reasonTemplate: value(row, "reasonTemplate"),
      category: value(row, "category"), requiredCapability: bool(value(row, "requiredCapability")),
      conditionalCapability: bool(value(row, "conditionalCapability")), sharedDocumentCapability: bool(value(row, "sharedDocumentCapability")),
      applicantScopedCapability: bool(value(row, "applicantScopedCapability")), travelGroupScopedCapability: bool(value(row, "travelGroupScopedCapability")),
      familyScopedCapability: bool(value(row, "familyScopedCapability")), aiExtractionCapability: bool(value(row, "aiExtractionCapability")),
      humanReviewPolicy: value(row, "humanReviewPolicy"), effectiveFrom: date(value(row, "effectiveFrom")),
      effectiveTo: value(row, "effectiveTo") === null ? null : date(value(row, "effectiveTo")), reviewStatus: value(row, "reviewStatus"),
    }));
    const questions = questionRows.map((row) => questionDefinitionSchema.parse({
      kind: "QUESTION", definitionId: value(row, "definitionId"), code: value(row, "code"),
      version: Number(value(row, "version")), status: value(row, "status"), questionType: value(row, "questionType"),
      customerLabel: value(row, "customerLabel"), shortCustomerExplanation: value(row, "shortCustomerExplanation"),
      internalLabel: value(row, "internalLabel"), classification: value(row, "classification"),
      authoritySemantics: value(row, "authoritySemantics"), reasonTemplate: value(row, "reasonTemplate"),
      helpText: value(row, "helpText"), answerType: value(row, "answerType"), allowedValues: json(value(row, "allowedValues")),
      validationContract: json(value(row, "validationContract")), customerVisible: bool(value(row, "customerVisible")),
      effectiveFrom: date(value(row, "effectiveFrom")), effectiveTo: value(row, "effectiveTo") === null ? null : date(value(row, "effectiveTo")),
      reviewStatus: value(row, "reviewStatus"),
    }));
    if (requirements.some((definition) => !isDefinitionEffective(definition, at))
      || questions.some((definition) => !isDefinitionEffective(definition, at))) throw new Error("CATALOG_EFFECTIVE_DATE_INVALID");
    const duplicate = (items: readonly { code: string }[]) => new Set(items.map(({ code }) => code)).size !== items.length;
    if (duplicate(requirements) || duplicate(questions)) throw new Error("CATALOG_ACTIVE_VERSION_CONFLICT");
    return { catalogVersion: `active-${at.toISOString()}`, requirements, questions };
  }
}
