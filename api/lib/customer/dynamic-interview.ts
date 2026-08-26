import { createHash, randomUUID } from "node:crypto";
import type { QuestionCatalogDefinition } from "../requirements/requirement-catalog";

export type InterviewEligibilityState = "NEEDS_MORE_INFORMATION" | "ELIGIBLE_ROUTE_FOUND" | "VISA_NOT_REQUIRED" | "VISA_ON_ARRIVAL" | "HUMAN_REVIEW_REQUIRED" | "NOT_RESEARCHED" | "NOT_ELIGIBLE" | "RULE_CONFLICT";
export type InterviewAnswer = string | number | boolean;
export type InterviewAnswerEvent = {
  eventId: string; applicationId: number; applicantId: number | null; questionDefinitionId: string;
  questionDefinitionVersion: number; answer: InterviewAnswer; answerSha256: string; supersedesEventId: string | null;
  changeReason: string; occurredAt: string;
};

function hash(answer: InterviewAnswer): string { return createHash("sha256").update(JSON.stringify(answer)).digest("hex"); }
function validateAnswer(definition: QuestionCatalogDefinition, answer: InterviewAnswer): void {
  if (definition.answerType === "BOOLEAN" && typeof answer !== "boolean") throw new Error("INTERVIEW_ANSWER_INVALID");
  if (definition.answerType === "NUMBER" && (typeof answer !== "number" || !Number.isFinite(answer))) throw new Error("INTERVIEW_ANSWER_INVALID");
  if (definition.answerType === "DATE" && (typeof answer !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(answer) || Number.isNaN(Date.parse(`${answer}T00:00:00Z`)))) throw new Error("INTERVIEW_ANSWER_INVALID");
  if ((definition.answerType === "TEXT" || definition.answerType === "SELECT") && (typeof answer !== "string" || !answer.trim())) throw new Error("INTERVIEW_ANSWER_INVALID");
  if (definition.allowedValues && !definition.allowedValues.includes(String(answer))) throw new Error("INTERVIEW_ANSWER_NOT_ALLOWED");
  const maxLength = definition.validationContract.maxLength;
  if (typeof answer === "string" && typeof maxLength === "number" && answer.length > maxLength) throw new Error("INTERVIEW_ANSWER_TOO_LONG");
}

export class InMemoryInterviewAnswerHistory {
  readonly #events: InterviewAnswerEvent[] = [];
  append(input: Omit<InterviewAnswerEvent, "eventId" | "answerSha256" | "supersedesEventId"> & { definition: QuestionCatalogDefinition }): InterviewAnswerEvent {
    if (input.definition.definitionId !== input.questionDefinitionId || input.definition.version !== input.questionDefinitionVersion) throw new Error("INTERVIEW_QUESTION_VERSION_MISMATCH");
    validateAnswer(input.definition, input.answer);
    const previous = this.current(input.applicationId, input.applicantId, input.questionDefinitionId);
    if (previous?.answerSha256 === hash(input.answer)) return previous;
    if (previous && !input.changeReason.trim()) throw new Error("INTERVIEW_CHANGE_REASON_REQUIRED");
    const event: InterviewAnswerEvent = { ...input, definition: undefined, eventId: randomUUID(), answerSha256: hash(input.answer),
      supersedesEventId: previous?.eventId ?? null } as InterviewAnswerEvent;
    this.#events.push(event); return structuredClone(event);
  }
  current(applicationId: number, applicantId: number | null, definitionId: string): InterviewAnswerEvent | null {
    return structuredClone(this.#events.filter((event) => event.applicationId === applicationId && event.applicantId === applicantId
      && event.questionDefinitionId === definitionId).at(-1) ?? null);
  }
  all(applicationId: number): readonly InterviewAnswerEvent[] { return this.#events.filter((event) => event.applicationId === applicationId).map((event) => structuredClone(event)); }
}

export type DynamicInterviewState = {
  currentStep: "PROFILE" | "TRAVEL_PARTY" | "TRAVEL_DATES" | "REVIEW";
  currentQuestions: readonly { code: string; applicantId: number | null; label: string; helpText: string; whyQuestionIsNeeded: string; answerType: QuestionCatalogDefinition["answerType"]; allowedValues: readonly string[] | null }[];
  knownAnswers: readonly { code: string; applicantId: number | null; answer: InterviewAnswer }[];
  eligibilityState: InterviewEligibilityState;
  nextAction: "ANSWER_QUESTIONS" | "REVIEW_REQUIREMENTS" | "HUMAN_REVIEW";
};

export type InterviewAnswerLookup = {
  current(applicationId: number, applicantId: number | null, definitionId: string): InterviewAnswerEvent | null;
};

export function buildDynamicInterviewState(input: {
  applicationId: number; applicantIds: readonly number[]; requiredQuestionCodes: readonly { code: string; applicantId: number | null; reason: string }[];
  questionCatalog: readonly QuestionCatalogDefinition[]; history: InterviewAnswerLookup; evaluatedState?: Exclude<InterviewEligibilityState, "NEEDS_MORE_INFORMATION">;
}): DynamicInterviewState {
  const allowedApplicants = new Set(input.applicantIds);
  const catalog = new Map(input.questionCatalog.filter((question) => question.customerVisible && question.classification !== "INTERNAL").map((question) => [question.code, question]));
  const questions = input.requiredQuestionCodes.map((required) => {
    if (required.applicantId !== null && !allowedApplicants.has(required.applicantId)) throw new Error("INTERVIEW_APPLICANT_OWNERSHIP_INVALID");
    const definition = catalog.get(required.code); if (!definition) throw new Error(`INTERVIEW_QUESTION_UNRESOLVED:${required.code}`);
    return { required, definition, answer: input.history.current(input.applicationId, required.applicantId, definition.definitionId) };
  });
  const unanswered = questions.filter(({ answer }) => !answer);
  const current = unanswered.slice(0, 1).map(({ required, definition }) => ({ code: definition.code, applicantId: required.applicantId,
    label: definition.customerLabel, helpText: definition.helpText, whyQuestionIsNeeded: required.reason,
    answerType: definition.answerType, allowedValues: definition.allowedValues }));
  const knownAnswers = questions.flatMap(({ required, definition, answer }) => answer ? [{ code: definition.code, applicantId: required.applicantId, answer: answer.answer }] : []);
  const state = current.length ? "NEEDS_MORE_INFORMATION" : input.evaluatedState ?? "NOT_RESEARCHED";
  const travelCodes = new Set(["TRAVELLING_TOGETHER", "ACCOMPANYING_PERSON", "TRAVEL_GROUP"]);
  const dateCodes = new Set(["PLANNED_ARRIVAL_DATE", "PLANNED_DEPARTURE_DATE", "HAS_CONFIRMED_TICKETS"]);
  return { currentStep: current.some(({ code }) => travelCodes.has(code)) ? "TRAVEL_PARTY" : current.some(({ code }) => dateCodes.has(code)) ? "TRAVEL_DATES" : current.length ? "PROFILE" : "REVIEW",
    currentQuestions: current, knownAnswers, eligibilityState: state,
    nextAction: current.length ? "ANSWER_QUESTIONS" : ["HUMAN_REVIEW_REQUIRED", "NOT_RESEARCHED", "RULE_CONFLICT"].includes(state) ? "HUMAN_REVIEW" : "REVIEW_REQUIREMENTS" };
}
