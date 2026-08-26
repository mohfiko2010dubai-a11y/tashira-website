import type { FamilyEvaluation } from "../family/family-engine";

export type DocumentDefinition = {
  code: string;
  label: string;
  category: "IDENTITY" | "TRAVEL" | "RELATIONSHIP" | "RESIDENCE" | "SUPPORTING";
  classification?: "AUTHORITY_REQUIRED" | "TASHIRA_PROCESSING" | "MAY_BE_REQUIRED" | "OPTIONAL";
  definitionId?: string;
  definitionVersion?: number;
  shortCustomerExplanation?: string;
  reasonTemplate?: string;
  sharingScope?: "APPLICANT" | "TRAVEL_GROUP" | "FAMILY";
};

export type QuestionDefinition = {
  code: string;
  prompt: string;
  answerType: "BOOLEAN" | "SELECT" | "TEXT";
  options?: readonly string[];
  definitionId?: string;
  definitionVersion?: number;
  helpText?: string;
};

export type RequirementCatalog = {
  version: string;
  documents: readonly DocumentDefinition[];
  questions: readonly QuestionDefinition[];
};

export type ApplicantAnswers = Readonly<Record<number, Readonly<Record<string, string | undefined>>>>;

export type DynamicRequirementView = {
  catalogVersion: string;
  familyEligibilityState: FamilyEvaluation["finalEligibilityState"];
  applicants: readonly {
    applicantId: number;
    evaluationId: string;
    documents: readonly {
      code: string;
      label: string | null;
      category: DocumentDefinition["category"] | null;
      classification: NonNullable<DocumentDefinition["classification"]>;
      state: "REQUIRED" | "CONDITIONAL";
      reason: string;
      definitionId?: string | null;
      definitionVersion?: number | null;
      shortCustomerExplanation?: string | null;
      sharingScope?: "APPLICANT" | "TRAVEL_GROUP" | "FAMILY";
    }[];
    questions: readonly QuestionDefinition[];
    warnings: readonly string[];
    manualReviewRequired: boolean;
  }[];
};

function conditionMatches(answer: string | undefined, condition: {
  operator: "EQUALS" | "IN";
  value: string | readonly string[];
}): boolean | null {
  if (answer === undefined) return null;
  const expected = Array.isArray(condition.value) ? condition.value : [condition.value];
  return condition.operator === "EQUALS"
    ? expected.length === 1 && answer === expected[0]
    : expected.includes(answer);
}

export function buildDynamicRequirements(input: {
  family: FamilyEvaluation;
  catalog: RequirementCatalog;
  answers: ApplicantAnswers;
}): DynamicRequirementView {
  const documents = new Map(input.catalog.documents.map((document) => [document.code, document]));
  const questions = new Map(input.catalog.questions.map((question) => [question.code, question]));
  return {
    catalogVersion: input.catalog.version,
    familyEligibilityState: input.family.finalEligibilityState,
    applicants: input.family.members.map((member) => {
      const warnings = [...member.warnings];
      const applicantDocuments: Array<DynamicRequirementView["applicants"][number]["documents"][number]> = [];
      const applicantQuestions = new Map<string, QuestionDefinition>();
      for (const requirement of member.requiredDocuments) {
        const definition = documents.get(requirement.code);
        if (!definition) warnings.push(`UNKNOWN_DOCUMENT_DEFINITION:${requirement.code}`);
        applicantDocuments.push({
          code: requirement.code,
          label: definition?.label ?? null,
          category: definition?.category ?? null,
          classification: definition?.classification ?? "AUTHORITY_REQUIRED",
          state: "REQUIRED",
          reason: definition?.reasonTemplate ?? "Required by the selected eligibility evaluation",
          definitionId: definition?.definitionId ?? null,
          definitionVersion: definition?.definitionVersion ?? null,
          shortCustomerExplanation: definition?.shortCustomerExplanation ?? null,
          sharingScope: definition?.sharingScope ?? "APPLICANT",
        });
      }
      for (const requirement of member.conditionalDocuments) {
        const definition = documents.get(requirement.code);
        if (!definition) warnings.push(`UNKNOWN_DOCUMENT_DEFINITION:${requirement.code}`);
        if (!requirement.when) {
          applicantDocuments.push({
            code: requirement.code, label: definition?.label ?? null, category: definition?.category ?? null,
            classification: definition?.classification ?? "MAY_BE_REQUIRED",
            state: "CONDITIONAL", reason: definition?.reasonTemplate ?? requirement.reason,
            definitionId: definition?.definitionId ?? null, definitionVersion: definition?.definitionVersion ?? null,
            shortCustomerExplanation: definition?.shortCustomerExplanation ?? null, sharingScope: definition?.sharingScope ?? "APPLICANT",
          });
          continue;
        }
        const question = questions.get(requirement.when.questionCode);
        if (!question) {
          warnings.push(`UNKNOWN_QUESTION_DEFINITION:${requirement.when.questionCode}`);
          continue;
        }
        const answer = input.answers[member.applicantId]?.[question.code];
        const matches = conditionMatches(answer, requirement.when);
        if (matches === null) {
          applicantQuestions.set(question.code, question);
          applicantDocuments.push({
            code: requirement.code, label: definition?.label ?? null, category: definition?.category ?? null,
            classification: definition?.classification ?? "MAY_BE_REQUIRED",
            state: "CONDITIONAL", reason: definition?.reasonTemplate ?? requirement.reason,
            definitionId: definition?.definitionId ?? null, definitionVersion: definition?.definitionVersion ?? null,
            shortCustomerExplanation: definition?.shortCustomerExplanation ?? null, sharingScope: definition?.sharingScope ?? "APPLICANT",
          });
        } else if (matches) {
          applicantDocuments.push({
            code: requirement.code, label: definition?.label ?? null, category: definition?.category ?? null,
            classification: definition?.classification ?? "MAY_BE_REQUIRED",
            state: "REQUIRED", reason: definition?.reasonTemplate ?? requirement.reason,
            definitionId: definition?.definitionId ?? null, definitionVersion: definition?.definitionVersion ?? null,
            shortCustomerExplanation: definition?.shortCustomerExplanation ?? null, sharingScope: definition?.sharingScope ?? "APPLICANT",
          });
        }
      }
      const uniqueWarnings = [...new Set(warnings)].sort((left, right) => left.localeCompare(right));
      return {
        applicantId: member.applicantId,
        evaluationId: member.evaluationId,
        documents: applicantDocuments.sort((left, right) => left.code.localeCompare(right.code)),
        questions: [...applicantQuestions.values()].sort((left, right) => left.code.localeCompare(right.code)),
        warnings: uniqueWarnings,
        manualReviewRequired: uniqueWarnings.some((warning) => warning.startsWith("UNKNOWN_"))
          || member.eligibilityState === "HUMAN_REVIEW_REQUIRED"
          || member.eligibilityState === "RULE_CONFLICT",
      };
    }),
  };
}
