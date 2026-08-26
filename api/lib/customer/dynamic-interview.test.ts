import { describe, expect, it } from "vitest";
import type { QuestionCatalogDefinition } from "../requirements/requirement-catalog";
import { buildDynamicInterviewState, InMemoryInterviewAnswerHistory } from "./dynamic-interview";

const question = (code: string, answerType: QuestionCatalogDefinition["answerType"] = "TEXT"): QuestionCatalogDefinition => ({
  kind: "QUESTION", definitionId: `00000000-0000-4000-8000-${code.length.toString().padStart(12, "0")}`, code, version: 1,
  status: "ACTIVE", questionType: code, customerLabel: code, shortCustomerExplanation: "Needed for evaluation", internalLabel: code,
  classification: "CONDITIONAL", authoritySemantics: null, reasonTemplate: "May be required depending on your case.", helpText: "Answer accurately.",
  answerType, allowedValues: null, validationContract: { maxLength: 100 }, customerVisible: true,
  effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveTo: null, reviewStatus: "APPROVED",
});

describe("dynamic interview", () => {
  it("asks only the first rule-required unanswered question and preserves history", () => {
    const history = new InMemoryInterviewAnswerHistory(); const nationality = question("NATIONALITY"); const gcc = question("GCC_RESIDENT", "BOOLEAN");
    const required = [{ code: "NATIONALITY", applicantId: 1, reason: "Needed to select applicable rules" }, { code: "GCC_RESIDENT", applicantId: 1, reason: "Required by a residence overlay" }];
    expect(buildDynamicInterviewState({ applicationId: 7, applicantIds: [1], requiredQuestionCodes: required, questionCatalog: [nationality, gcc], history }).currentQuestions[0].code).toBe("NATIONALITY");
    history.append({ applicationId: 7, applicantId: 1, questionDefinitionId: nationality.definitionId, questionDefinitionVersion: 1,
      answer: "EG", changeReason: "Initial answer", occurredAt: new Date().toISOString(), definition: nationality });
    expect(buildDynamicInterviewState({ applicationId: 7, applicantIds: [1], requiredQuestionCodes: required, questionCatalog: [nationality, gcc], history }).currentQuestions[0].code).toBe("GCC_RESIDENT");
  });

  it("rejects cross-applicant and malformed answers", () => {
    const history = new InMemoryInterviewAnswerHistory(); const gcc = question("GCC_RESIDENT", "BOOLEAN");
    expect(() => buildDynamicInterviewState({ applicationId: 7, applicantIds: [1], requiredQuestionCodes: [{ code: "GCC_RESIDENT", applicantId: 2, reason: "Rule" }], questionCatalog: [gcc], history }))
      .toThrow("INTERVIEW_APPLICANT_OWNERSHIP_INVALID");
    expect(() => history.append({ applicationId: 7, applicantId: 1, questionDefinitionId: gcc.definitionId, questionDefinitionVersion: 1,
      answer: "yes", changeReason: "Initial", occurredAt: new Date().toISOString(), definition: gcc })).toThrow("INTERVIEW_ANSWER_INVALID");
  });

  it("fails unresolved questions closed and routes conflict to human review", () => {
    const history = new InMemoryInterviewAnswerHistory();
    expect(() => buildDynamicInterviewState({ applicationId: 7, applicantIds: [1], requiredQuestionCodes: [{ code: "UNKNOWN", applicantId: 1, reason: "Rule" }], questionCatalog: [], history }))
      .toThrow("INTERVIEW_QUESTION_UNRESOLVED:UNKNOWN");
    expect(buildDynamicInterviewState({ applicationId: 7, applicantIds: [1], requiredQuestionCodes: [], questionCatalog: [], history, evaluatedState: "RULE_CONFLICT" }))
      .toMatchObject({ eligibilityState: "RULE_CONFLICT", nextAction: "HUMAN_REVIEW" });
  });
});
