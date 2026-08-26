import { describe, expect, it } from "vitest";
import type { EligibilityRule } from "../eligibility/eligibility-engine";
import type { QuestionCatalogDefinition } from "../requirements/requirement-catalog";
import { InMemoryInterviewAnswerHistory } from "./dynamic-interview";
import { buildPersistentDynamicInterview } from "./dynamic-interview-service";

const at = new Date("2026-08-26T00:00:00Z");
function question(code: string, answerType: QuestionCatalogDefinition["answerType"] = "TEXT"): QuestionCatalogDefinition {
  return { definitionId: `${code === "NATIONALITY" ? "11111111" : code === "GCC_RESIDENT" ? "22222222" : "33333333"}-1111-4111-8111-111111111111`,
    code, version: 1, status: "ACTIVE", kind: "QUESTION", customerLabel: code, shortCustomerExplanation: "Safe explanation",
    internalLabel: code, classification: "OFFICIAL", authoritySemantics: null, reasonTemplate: "Required by active rule",
    effectiveFrom: at, effectiveTo: null, reviewStatus: "APPROVED", questionType: code, helpText: "Help", answerType,
    allowedValues: null, validationContract: {}, customerVisible: true };
}
const rule: EligibilityRule = { id: "BASE", version: 1, routeCode: "UAE_VISIT", layer: "BASE_ROUTE", classification: "OFFICIAL",
  sourceAuthority: "Synthetic staging authority", reason: "Synthetic test route", effectiveFrom: at, effectiveTo: null,
  conditions: [{ field: "nationality", operator: "EXISTS" }], eligibilityEffect: "ELIGIBLE", requiredDocuments: ["PASSPORT"], conditionalDocuments: [] };

describe("persistent dynamic interview composition", () => {
  it("asks only the first rule-relevant unanswered question and then evaluates", () => {
    const nationality = question("NATIONALITY"); const history = new InMemoryInterviewAnswerHistory();
    const base = { applicationId: 9, routeCode: "UAE_VISIT", applicantIds: [21], questions: [nationality], rules: [rule], evaluatedAt: at };
    expect(buildPersistentDynamicInterview({ ...base, events: history.all(9) }).currentQuestions[0].code).toBe("NATIONALITY");
    history.append({ applicationId: 9, applicantId: 21, questionDefinitionId: nationality.definitionId, questionDefinitionVersion: 1,
      answer: "EG", changeReason: "INITIAL_ANSWER", occurredAt: at.toISOString(), definition: nationality });
    expect(buildPersistentDynamicInterview({ ...base, events: history.all(9) })).toMatchObject({ eligibilityState: "ELIGIBLE_ROUTE_FOUND", nextAction: "REVIEW_REQUIREMENTS" });
  });

  it("does not ask GCC country until GCC residence is confirmed", () => {
    const nationality = question("NATIONALITY"), gcc = question("GCC_RESIDENT", "BOOLEAN"), country = question("GCC_COUNTRY");
    const gccRule: EligibilityRule = { ...rule, id: "GCC", layer: "GCC_OVERLAY", eligibilityEffect: "NO_CHANGE",
      conditions: [{ field: "gccCountry", operator: "EXISTS" }] };
    const history = new InMemoryInterviewAnswerHistory();
    history.append({ applicationId: 9, applicantId: 21, questionDefinitionId: nationality.definitionId, questionDefinitionVersion: 1,
      answer: "EG", changeReason: "INITIAL_ANSWER", occurredAt: at.toISOString(), definition: nationality });
    const base = { applicationId: 9, routeCode: "UAE_VISIT", applicantIds: [21], questions: [nationality, gcc, country], rules: [rule, gccRule], evaluatedAt: at };
    expect(buildPersistentDynamicInterview({ ...base, events: history.all(9) }).currentQuestions[0].code).toBe("GCC_RESIDENT");
    history.append({ applicationId: 9, applicantId: 21, questionDefinitionId: gcc.definitionId, questionDefinitionVersion: 1,
      answer: false, changeReason: "INITIAL_ANSWER", occurredAt: at.toISOString(), definition: gcc });
    expect(buildPersistentDynamicInterview({ ...base, events: history.all(9) }).currentQuestions).toHaveLength(0);
  });

  it("keeps applicants isolated in a mixed family", () => {
    const nationality = question("NATIONALITY");
    const travelling = { ...question("GCC_COUNTRY"), definitionId: "44444444-1111-4111-8111-111111111111", code: "TRAVELLING_TOGETHER",
      customerLabel: "Are all applicants travelling together?", answerType: "BOOLEAN" as const };
    const history = new InMemoryInterviewAnswerHistory();
    history.append({ applicationId: 9, applicantId: 21, questionDefinitionId: nationality.definitionId, questionDefinitionVersion: 1,
      answer: "EG", changeReason: "INITIAL_ANSWER", occurredAt: at.toISOString(), definition: nationality });
    const state = buildPersistentDynamicInterview({ applicationId: 9, routeCode: "UAE_VISIT", applicantIds: [21, 22],
      questions: [nationality, travelling], rules: [rule], events: history.all(9), evaluatedAt: at });
    expect(state.currentQuestions[0]).toMatchObject({ code: "NATIONALITY", applicantId: 22 });
    expect(state.knownAnswers).toEqual([{ code: "NATIONALITY", applicantId: 21, answer: "EG" }]);
  });
});
