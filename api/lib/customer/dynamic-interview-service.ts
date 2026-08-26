import { evaluateEligibility, type EligibilityProfile, type EligibilityRule } from "../eligibility/eligibility-engine";
import { customerReason, type QuestionCatalogDefinition, type RequirementCatalogDefinition } from "../requirements/requirement-catalog";
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

function customerMessage(state: InterviewEligibilityState): string {
  if (state === "RULE_CONFLICT" || state === "HUMAN_REVIEW_REQUIRED") return "A TASHIRA specialist must review this applicant before the next step.";
  if (state === "NOT_RESEARCHED") return "This applicant needs specialist review because verified route information is not yet available.";
  if (state === "NOT_ELIGIBLE") return "The selected route is not available for this applicant based on the current verified information.";
  if (state === "VISA_NOT_REQUIRED") return "A visa is not required for this applicant under the selected route.";
  if (state === "VISA_ON_ARRIVAL") return "This applicant may qualify for visa on arrival; a specialist will confirm the travel requirements.";
  if (state === "NEEDS_MORE_INFORMATION") return "Answer the remaining questions for this applicant.";
  return "This applicant is ready to review the listed requirements.";
}

export function buildPersistentDynamicInterview(input: { applicationId: number; routeCode: string; applicantIds: readonly number[];
  questions: readonly QuestionCatalogDefinition[]; requirements?: readonly RequirementCatalogDefinition[]; rules: readonly EligibilityRule[]; events: readonly InterviewAnswerEvent[];
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
  const applicantReview = input.applicantIds.map((applicantId) => {
    const applicantHasUnanswered = requiredQuestionCodes.some((required) => required.applicantId === applicantId && (() => {
      const definition = input.questions.find((question) => question.code === required.code);
      return !definition || !lookup.current(input.applicationId, applicantId, definition.definitionId);
    })());
    if (applicantHasUnanswered) return { applicantId, eligibilityState: "NEEDS_MORE_INFORMATION" as const,
      requirements: [], customerMessage: customerMessage("NEEDS_MORE_INFORMATION") };
      const attributes: Record<string, string | number | boolean> = {};
      for (const event of latest.filter((answer) => answer.applicantId === applicantId)) {
        const code = codeByDefinition.get(event.questionDefinitionId); const field = code ? codeField[code] : undefined;
        if (field && code && relevantAnswerKeys.has(`${applicantId}:${code}`)) attributes[field] = event.answer;
      }
      const profile: EligibilityProfile = { routeCode: input.routeCode, attributes };
      const result = evaluateEligibility({ profile, rules: input.rules, evaluatedAt: input.evaluatedAt });
      const eligibilityState: InterviewEligibilityState = result.finalEligibilityState === "ELIGIBLE" ? "ELIGIBLE_ROUTE_FOUND"
        : result.finalEligibilityState === "INELIGIBLE" ? "NOT_ELIGIBLE" : result.finalEligibilityState;
      const definitions = new Map((input.requirements ?? []).filter(({ classification }) => classification !== "INTERNAL").map((definition) => [definition.code, definition]));
      const project = (code: string, state: "REQUIRED" | "CONDITIONAL") => {
        const definition = definitions.get(code);
        if (!definition) throw new Error(`INTERVIEW_REQUIREMENT_UNRESOLVED:${code}`);
        const classification = definition.classification === "OFFICIAL" ? "AUTHORITY_REQUIRED" as const
          : definition.classification === "OPERATIONAL" ? "TASHIRA_PROCESSING" as const
            : definition.classification === "CONDITIONAL" ? "MAY_BE_REQUIRED" as const : "OPTIONAL" as const;
        return { code, label: definition.customerLabel, classification, state, explanation: customerReason(definition) };
      };
      const required = result.requiredDocuments.map((code) => project(code, "REQUIRED"));
      const conditional = [...new Set(result.conditionalDocuments.map(({ code }) => code))].sort().map((code) => project(code, "CONDITIONAL"));
      return { applicantId, eligibilityState, requirements: [...required, ...conditional], customerMessage: customerMessage(eligibilityState) };
  });
  const evaluatedState = unanswered ? undefined : aggregate(applicantReview.map(({ eligibilityState }) => eligibilityState));
  return buildDynamicInterviewState({ applicationId: input.applicationId, applicantIds: input.applicantIds,
    requiredQuestionCodes, questionCatalog: input.questions, history: lookup, evaluatedState, applicantReview });
}
