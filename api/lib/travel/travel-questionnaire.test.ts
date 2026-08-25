import { describe, expect, it } from "vitest";
import { buildTravelQuestionnaire } from "./travel-questionnaire";

describe("rule-driven travel questionnaire", () => {
  it("asks only questions required by active rules", () => {
    const questions = buildTravelQuestionnaire([
      { ruleId: "minor-1", trigger: "MINOR_ACCOMPANIMENT", applicantIds: [3] },
      { ruleId: "schedule-1", trigger: "SUBMISSION_SCHEDULING", applicantIds: [1, 3] },
    ]);
    expect(questions.map((question) => question.code)).not.toContain("CONFIRMED_TICKETS");
    expect(questions.filter((question) => question.code === "TRAVELLING_WITH")).toEqual([
      { code: "TRAVELLING_WITH", applicantId: 3, reasonRuleIds: ["minor-1"] },
    ]);
  });

  it("keeps applicant questions isolated and deduplicates case questions", () => {
    const questions = buildTravelQuestionnaire([
      { ruleId: "family-a", trigger: "FAMILY_TRAVEL_ARRANGEMENT", applicantIds: [1, 2] },
      { ruleId: "family-b", trigger: "FAMILY_TRAVEL_ARRANGEMENT", applicantIds: [3] },
      { ruleId: "ticket", trigger: "TICKET_REQUIREMENT", applicantIds: [1, 2] },
    ]);
    expect(questions.filter((question) => question.code === "ALL_APPLICANTS_TRAVELLING_TOGETHER")).toHaveLength(1);
    expect(questions.filter((question) => question.code === "CONFIRMED_TICKETS").map((question) => question.applicantId)).toEqual([1, 2]);
  });
});
