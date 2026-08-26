import { evaluateEligibility, type EligibilityProfile, type EligibilityRule } from "../eligibility/eligibility-engine";
import type { QuestionCatalogDefinition } from "../requirements/requirement-catalog";
import { buildDynamicInterviewState, type DynamicInterviewState, type InterviewAnswerEvent, type InterviewAnswerLookup, type InterviewEligibilityState } from "./dynamic-interview";
import { deriveRequiredInterviewQuestions } from "./dynamic-question-progression";

const codeField: Readonly<Record<string, string>> = {
  NATIONALITY: "nationality", PASSPORT_COUNTRY: "passportCountry", RESIDENCE_COUNTRY: "residenceCountry",
  RESIDENCE_TYPE: "residenceType", GCC_RESIDENT: "gccResident", GCC_COUNTRY: "gccCountry",
  RESIDENCE_EXPIRY: "residenceExpiry", PROFESSION: "profession", DATE_OF_BIRTH: "dateOfBirth",
  INSIDE_OUTSIDE_UAE: "insideOutsideUae", PLANNED_ARRIVAL_DATE: "plannedArrivalDate",
  PLANNED_DEPARTURE_DATE: "plannedDepartureDate", HAS_CONFIRMED_TICKETS: "hasConfirmedTickets",
};

function currentEvents(events: readonly InterviewAnswerEvent[]): InterviewAnswerEvent[] {
  const current = new Map<string, InterviewAnswerEvent>();
  for (const event of events) current.set(`${event.applicantId ?? "APPLICATION"}:${event.questionDefinitionId}`, event);
  return [...current.values()];
}

function aggregate(states: readonly InterviewEligibilityState[]): Exclude<InterviewEligibilityState, "NEEDS_MORE_INFORMATION"> {
  if (states.includes("RULE_CONFLICT")) return "RULE_CONFLICT";
  if (states.includes("HUMAN_REVIEW_REQUIRED")) return "HUMAN_REVIEW_REQUIRED";
  if (states.includes("NOT_ELIGIBLE")) return "NOT_ELIGIBLE";
  if (states.includes("NOT_RESEARCHED")) return "NOT_RESEARCHED";
  if (states.includes("VISA_NOT_REQUIRED")) return "VISA_NOT_REQUIRED";
  if (states.includes("VISA_ON_ARRIVAL")) return "VISA_ON_ARRIVAL";
  return "ELIGIBLE_ROUTE_FOUND";
}

export function buildPersistentDynamicInterview(input: { applicationId: number; routeCode: string; applicantIds: readonly number[];
  questions: readonly QuestionCatalogDefinition[]; rules: readonly EligibilityRule[]; events: readonly InterviewAnswerEvent[];
  evaluatedAt: Date }): DynamicInterviewState {
  const latest = currentEvents(input.events);
  const codeByDefinition = new Map(input.questions.map((question) => [question.definitionId, question.code]));
  const requiredQuestionCodes = deriveRequiredInterviewQuestions({ applicantIds: input.applicantIds, rules: input.rules,
    currentAnswers: latest, definitionCodeById: codeByDefinition });
  const relevantAnswerKeys = new Set(requiredQuestionCodes.map((required) => `${required.applicantId ?? "APPLICATION"}:${required.code}`));
  const latestByKey = new Map(latest.map((event) => [`${event.applicantId ?? "APPLICATION"}:${event.questionDefinitionId}`, event]));
  const lookup: InterviewAnswerLookup = { current: (_applicationId, applicantId, definitionId) => latestByKey.get(`${applicantId ?? "APPLICATION"}:${definitionId}`) ?? null };
  const unanswered = requiredQuestionCodes.some((required) => {
    const definition = input.questions.find((question) => question.code === required.code);
    return !definition || !lookup.current(input.applicationId, required.applicantId, definition.definitionId);
  });
  let evaluatedState: Exclude<InterviewEligibilityState, "NEEDS_MORE_INFORMATION"> | undefined;
  if (!unanswered) {
    const states = input.applicantIds.map((applicantId) => {
      const attributes: Record<string, string | number | boolean> = {};
      for (const event of latest.filter((answer) => answer.applicantId === applicantId)) {
        const code = codeByDefinition.get(event.questionDefinitionId); const field = code ? codeField[code] : undefined;
        if (field && code && relevantAnswerKeys.has(`${applicantId}:${code}`)) attributes[field] = event.answer;
      }
      const profile: EligibilityProfile = { routeCode: input.routeCode, attributes };
      const result = evaluateEligibility({ profile, rules: input.rules, evaluatedAt: input.evaluatedAt });
      if (result.finalEligibilityState === "ELIGIBLE") return "ELIGIBLE_ROUTE_FOUND" as const;
      if (result.finalEligibilityState === "INELIGIBLE") return "NOT_ELIGIBLE" as const;
      return result.finalEligibilityState;
    });
    evaluatedState = aggregate(states);
  }
  return buildDynamicInterviewState({ applicationId: input.applicationId, applicantIds: input.applicantIds,
    requiredQuestionCodes, questionCatalog: input.questions, history: lookup, evaluatedState });
}
