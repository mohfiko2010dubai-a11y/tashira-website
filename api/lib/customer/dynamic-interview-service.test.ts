import { describe, expect, it } from "vitest";
import type { EligibilityRule } from "../eligibility/eligibility-engine";
import type { QuestionCatalogDefinition, RequirementCatalogDefinition } from "../requirements/requirement-catalog";
import { InMemoryInterviewAnswerHistory } from "./dynamic-interview";
import { buildPersistentDynamicInterview, evaluateCompletedInterviewApplicants } from "./dynamic-interview-service";

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
function requirement(code: string): RequirementCatalogDefinition { return { kind: "DOCUMENT", definitionId: `${code === "PASSPORT" ? "77777777" : "88888888"}-1111-4111-8111-111111111111`,
  code, version: 1, status: "ACTIVE", customerLabel: code === "PASSPORT" ? "Passport copy" : "Bank statement", shortCustomerExplanation: "Safe explanation",
  internalLabel: code, classification: "OFFICIAL", authoritySemantics: null, reasonTemplate: "Required by the selected route", effectiveFrom: at, effectiveTo: null,
  reviewStatus: "APPROVED", documentType: code, category: "IDENTITY", requiredCapability: true, conditionalCapability: false,
  sharedDocumentCapability: false, applicantScopedCapability: true, travelGroupScopedCapability: false, familyScopedCapability: false,
  aiExtractionCapability: false, humanReviewPolicy: "ALWAYS" }; }
const requirements = [requirement("PASSPORT"), requirement("BANK_STATEMENT")];

describe("persistent dynamic interview composition", () => {
  it("asks only the first rule-relevant unanswered question and then evaluates", () => {
    const nationality = question("NATIONALITY"); const history = new InMemoryInterviewAnswerHistory();
    const base = { applicationId: 9, routeCode: "UAE_VISIT", applicantIds: [21], questions: [nationality], requirements, rules: [rule], evaluatedAt: at };
    expect(buildPersistentDynamicInterview({ ...base, events: history.all(9) }).currentQuestions[0].code).toBe("NATIONALITY");
    history.append({ applicationId: 9, applicantId: 21, questionDefinitionId: nationality.definitionId, questionDefinitionVersion: 1,
      answer: "EG", changeReason: "INITIAL_ANSWER", occurredAt: at.toISOString(), definition: nationality });
    expect(buildPersistentDynamicInterview({ ...base, events: history.all(9) })).toMatchObject({ eligibilityState: "ELIGIBLE_ROUTE_FOUND", nextAction: "REVIEW_REQUIREMENTS" });
    expect(buildPersistentDynamicInterview({ ...base, events: history.all(9) }).review.applicants[0]).toMatchObject({
      applicantId: 21, eligibilityState: "ELIGIBLE_ROUTE_FOUND", requirements: [expect.objectContaining({ code: "PASSPORT", label: "Passport copy" })] });
    expect(evaluateCompletedInterviewApplicants({ ...base, events: history.all(9) })).toEqual([
      expect.objectContaining({ applicantId: 21, profile: { routeCode: "UAE_VISIT", attributes: { nationality: "EG" } },
        result: expect.objectContaining({ finalEligibilityState: "ELIGIBLE", requiredDocuments: ["PASSPORT"] }) }),
    ]);
  });

  it("returns customer-safe independent family review requirements", () => {
    const nationality = question("NATIONALITY"); const history = new InMemoryInterviewAnswerHistory();
    const pakistan: EligibilityRule = { ...rule, id: "PK", layer: "NATIONALITY_OVERLAY", eligibilityEffect: "NO_CHANGE",
      conditions: [{ field: "nationality", operator: "EQUALS", value: "PK" }], requiredDocuments: ["BANK_STATEMENT"] };
    for (const [applicantId, answer] of [[21, "EG"], [22, "PK"]] as const) history.append({ applicationId: 9, applicantId,
      questionDefinitionId: nationality.definitionId, questionDefinitionVersion: 1, answer, changeReason: "INITIAL_ANSWER", occurredAt: at.toISOString(), definition: nationality });
    const travelling = { ...question("GCC_COUNTRY"), definitionId: "44444444-1111-4111-8111-111111111111", code: "TRAVELLING_TOGETHER", answerType: "BOOLEAN" as const };
    history.append({ applicationId: 9, applicantId: null, questionDefinitionId: travelling.definitionId, questionDefinitionVersion: 1,
      answer: true, changeReason: "INITIAL_ANSWER", occurredAt: at.toISOString(), definition: travelling });
    const state = buildPersistentDynamicInterview({ applicationId: 9, routeCode: "UAE_VISIT", applicantIds: [21, 22], questions: [nationality, travelling],
      requirements, rules: [rule, pakistan], events: history.all(9), evaluatedAt: at });
    expect(state.review.applicants).toEqual([
      expect.objectContaining({ applicantId: 21, requirements: [expect.objectContaining({ code: "PASSPORT" })] }),
      expect.objectContaining({ applicantId: 22, requirements: [expect.objectContaining({ code: "BANK_STATEMENT" }), expect.objectContaining({ code: "PASSPORT" })] }),
    ]);
  });

  it("does not ask GCC country until GCC residence is confirmed", () => {
    const nationality = question("NATIONALITY"), gcc = question("GCC_RESIDENT", "BOOLEAN"), country = question("GCC_COUNTRY");
    const gccRule: EligibilityRule = { ...rule, id: "GCC", layer: "GCC_OVERLAY", eligibilityEffect: "NO_CHANGE",
      conditions: [{ field: "gccCountry", operator: "EXISTS" }] };
    const history = new InMemoryInterviewAnswerHistory();
    history.append({ applicationId: 9, applicantId: 21, questionDefinitionId: nationality.definitionId, questionDefinitionVersion: 1,
      answer: "EG", changeReason: "INITIAL_ANSWER", occurredAt: at.toISOString(), definition: nationality });
    const base = { applicationId: 9, routeCode: "UAE_VISIT", applicantIds: [21], questions: [nationality, gcc, country], requirements, rules: [rule, gccRule], evaluatedAt: at };
    expect(buildPersistentDynamicInterview({ ...base, events: history.all(9) }).currentQuestions[0].code).toBe("GCC_RESIDENT");
    history.append({ applicationId: 9, applicantId: 21, questionDefinitionId: gcc.definitionId, questionDefinitionVersion: 1,
      answer: false, changeReason: "INITIAL_ANSWER", occurredAt: at.toISOString(), definition: gcc });
    expect(buildPersistentDynamicInterview({ ...base, events: history.all(9) }).currentQuestions).toHaveLength(0);
  });

  it("stops a superseded GCC-dependent answer from affecting current evaluation", () => {
    const nationality = question("NATIONALITY"), gcc = question("GCC_RESIDENT", "BOOLEAN"), country = question("GCC_COUNTRY");
    const gccRule: EligibilityRule = { ...rule, id: "GCC", layer: "GCC_OVERLAY", eligibilityEffect: "INELIGIBLE",
      conditions: [{ field: "gccCountry", operator: "EQUALS", value: "AE" }] };
    const history = new InMemoryInterviewAnswerHistory();
    const append = (definition: QuestionCatalogDefinition, answer: string | boolean, reason: string) => history.append({ applicationId: 9, applicantId: 21,
      questionDefinitionId: definition.definitionId, questionDefinitionVersion: 1, answer, changeReason: reason, occurredAt: at.toISOString(), definition });
    append(nationality, "EG", "INITIAL_ANSWER"); append(gcc, true, "INITIAL_ANSWER"); append(country, "AE", "INITIAL_ANSWER");
    append(gcc, false, "CUSTOMER_CORRECTION");
    const state = buildPersistentDynamicInterview({ applicationId: 9, routeCode: "UAE_VISIT", applicantIds: [21], questions: [nationality, gcc, country],
      requirements, rules: [rule, gccRule], events: history.all(9), evaluatedAt: at });
    expect(state.currentQuestions).toHaveLength(0);
    expect(state.eligibilityState).toBe("ELIGIBLE_ROUTE_FOUND");
  });

  it("keeps applicants isolated in a mixed family", () => {
    const nationality = question("NATIONALITY");
    const travelling = { ...question("GCC_COUNTRY"), definitionId: "44444444-1111-4111-8111-111111111111", code: "TRAVELLING_TOGETHER",
      customerLabel: "Are all applicants travelling together?", answerType: "BOOLEAN" as const };
    const history = new InMemoryInterviewAnswerHistory();
    history.append({ applicationId: 9, applicantId: 21, questionDefinitionId: nationality.definitionId, questionDefinitionVersion: 1,
      answer: "EG", changeReason: "INITIAL_ANSWER", occurredAt: at.toISOString(), definition: nationality });
    const state = buildPersistentDynamicInterview({ applicationId: 9, routeCode: "UAE_VISIT", applicantIds: [21, 22],
      questions: [nationality, travelling], requirements, rules: [rule], events: history.all(9), evaluatedAt: at });
    expect(state.currentQuestions[0]).toMatchObject({ code: "NATIONALITY", applicantId: 22 });
    expect(state.knownAnswers).toEqual([{ code: "NATIONALITY", applicantId: 21, answer: "EG" }]);
  });
});
