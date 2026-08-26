import type { EligibilityRule } from "../eligibility/eligibility-engine";
import type { InterviewAnswerEvent } from "./dynamic-interview";

const fieldQuestion: Readonly<Record<string, string>> = {
  nationality: "NATIONALITY",
  passportCountry: "PASSPORT_COUNTRY",
  residenceCountry: "RESIDENCE_COUNTRY",
  residenceType: "RESIDENCE_TYPE",
  gccResident: "GCC_RESIDENT",
  gccCountry: "GCC_COUNTRY",
  residenceExpiry: "RESIDENCE_EXPIRY",
  profession: "PROFESSION",
  dateOfBirth: "DATE_OF_BIRTH",
  insideOutsideUae: "INSIDE_OUTSIDE_UAE",
  plannedArrivalDate: "PLANNED_ARRIVAL_DATE",
  plannedDepartureDate: "PLANNED_DEPARTURE_DATE",
  hasConfirmedTickets: "HAS_CONFIRMED_TICKETS",
};

export type RequiredInterviewQuestion = { code: string; applicantId: number | null; reason: string };

/** Questions come from fields used by governed ACTIVE rules, never from a static all-fields form. */
export function deriveRequiredInterviewQuestions(input: {
  applicantIds: readonly number[];
  rules: readonly EligibilityRule[];
  currentAnswers: readonly Pick<InterviewAnswerEvent, "applicantId" | "questionDefinitionId" | "answer">[];
  definitionCodeById: ReadonlyMap<string, string>;
}): RequiredInterviewQuestion[] {
  const requiredCodes = new Set(input.rules.flatMap((rule) => rule.conditions.map((condition) => fieldQuestion[condition.field])).filter((code): code is string => Boolean(code)));
  requiredCodes.add("NATIONALITY");
  if (requiredCodes.has("GCC_COUNTRY") || requiredCodes.has("RESIDENCE_EXPIRY")) requiredCodes.add("GCC_RESIDENT");
  const current = new Map(input.currentAnswers.map((answer) => [`${answer.applicantId ?? "APPLICATION"}:${input.definitionCodeById.get(answer.questionDefinitionId) ?? ""}`, answer.answer]));
  const result: RequiredInterviewQuestion[] = [];
  for (const applicantId of input.applicantIds) {
    for (const code of requiredCodes) {
      if (code === "GCC_COUNTRY" && current.get(`${applicantId}:GCC_RESIDENT`) !== true) continue;
      if (code === "RESIDENCE_EXPIRY" && current.get(`${applicantId}:GCC_RESIDENT`) !== true) continue;
      result.push({ code, applicantId, reason: code === "NATIONALITY" ? "Needed to select the rules that apply to this applicant." : "Needed by an active eligibility rule for this applicant." });
    }
  }
  if (input.applicantIds.length > 1) result.push({ code: "TRAVELLING_TOGETHER", applicantId: null, reason: "Needed to organize the travel party safely." });
  return result;
}
