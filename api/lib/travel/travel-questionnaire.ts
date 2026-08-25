export type TravelQuestionCode =
  | "ALL_APPLICANTS_TRAVELLING_TOGETHER"
  | "SAME_ENTRY_TRIP"
  | "TRAVELLING_WITH"
  | "CURRENT_UAE_LOCATION"
  | "CONFIRMED_TICKETS"
  | "PLANNED_ARRIVAL_DATE"
  | "PLANNED_DEPARTURE_DATE";

export type TravelQuestionTrigger =
  | "FAMILY_TRAVEL_ARRANGEMENT"
  | "MINOR_ACCOMPANIMENT"
  | "UAE_LOCATION"
  | "TICKET_REQUIREMENT"
  | "SUBMISSION_SCHEDULING";

export type TravelQuestion = {
  code: TravelQuestionCode;
  applicantId: number | null;
  reasonRuleIds: readonly string[];
};

export type ActiveTravelQuestionRule = {
  ruleId: string;
  trigger: TravelQuestionTrigger;
  applicantIds: readonly number[];
};

const triggerQuestions: Readonly<Record<TravelQuestionTrigger, readonly TravelQuestionCode[]>> = {
  FAMILY_TRAVEL_ARRANGEMENT: ["ALL_APPLICANTS_TRAVELLING_TOGETHER", "SAME_ENTRY_TRIP"],
  MINOR_ACCOMPANIMENT: ["TRAVELLING_WITH"],
  UAE_LOCATION: ["CURRENT_UAE_LOCATION"],
  TICKET_REQUIREMENT: ["CONFIRMED_TICKETS"],
  SUBMISSION_SCHEDULING: ["PLANNED_ARRIVAL_DATE", "PLANNED_DEPARTURE_DATE"],
};

export function buildTravelQuestionnaire(rules: readonly ActiveTravelQuestionRule[]): TravelQuestion[] {
  const questions = new Map<string, { code: TravelQuestionCode; applicantId: number | null; ruleIds: Set<string> }>();
  for (const rule of [...rules].sort((a, b) => a.ruleId.localeCompare(b.ruleId))) {
    const applicantIds = rule.trigger === "FAMILY_TRAVEL_ARRANGEMENT" ? [null] : [...new Set(rule.applicantIds)].sort((a, b) => a - b);
    for (const code of triggerQuestions[rule.trigger]) {
      for (const applicantId of applicantIds) {
        const key = `${code}:${applicantId ?? "CASE"}`;
        const entry = questions.get(key) ?? { code, applicantId, ruleIds: new Set<string>() };
        entry.ruleIds.add(rule.ruleId);
        questions.set(key, entry);
      }
    }
  }
  return [...questions.values()]
    .map((entry) => ({ code: entry.code, applicantId: entry.applicantId, reasonRuleIds: [...entry.ruleIds].sort() }))
    .sort((a, b) => a.code.localeCompare(b.code) || (a.applicantId ?? 0) - (b.applicantId ?? 0));
}
