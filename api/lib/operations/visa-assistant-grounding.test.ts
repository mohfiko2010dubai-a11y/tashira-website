import { describe, expect, it } from "vitest";
import { answerVisaAssistant } from "./visa-assistant-grounding";

const empty = { activeRules: [], approvedFaq: {}, policies: {}, approvedProcedures: {} };

describe("Visa Assistant grounding", () => {
  it("prioritizes active approved rules", () => {
    const result = answerVisaAssistant("route.documents", { ...empty, activeRules: [{ id: "rule", version: 2, questionKey: "route.documents", answer: "Passport required", authority: "ICP" }], approvedFaq: { "route.documents": "FAQ answer" } });
    expect(result).toMatchObject({ state: "ANSWERED", sourceType: "ACTIVE_RULE", answer: "Passport required" });
  });

  it("fails conflicting authoritative rules to human review", () => {
    const result = answerVisaAssistant("route.documents", { ...empty, activeRules: [
      { id: "a", version: 1, questionKey: "route.documents", answer: "Passport", authority: "Official A" },
      { id: "b", version: 1, questionKey: "route.documents", answer: "Passport and photo", authority: "Official B" },
    ] });
    expect(result.state).toBe("HUMAN_REVIEW_REQUIRED");
  });

  it("requires authorization for case-specific data", () => {
    expect(answerVisaAssistant("case.status", empty).state).toBe("AUTHENTICATION_REQUIRED");
    expect(answerVisaAssistant("case.status", { ...empty, authenticatedCase: { applicationReference: "TSH-1", customerAuthorized: true, statusAnswer: "Documents under review" } })).toMatchObject({ state: "ANSWERED", sourceType: "AUTHENTICATED_CASE" });
  });

  it("never invents unknown requirements", () => {
    expect(answerVisaAssistant("unknown.requirement", empty)).toMatchObject({ state: "HUMAN_REVIEW_REQUIRED", sourceType: "NONE" });
  });

  it("answers spouse, travel, scheduler and document questions only from authenticated evidence", () => {
    const extended = {
      ...empty,
      authenticatedCase: { applicationReference: "TSH-1", customerAuthorized: true },
      applicantRequirements: [{ applicantId: 2, relationship: "SPOUSE", answer: "Passport and residence proof are required.", evidenceReferences: ["evaluation:spouse"] }],
      travelPartyAnswers: { "travel.together": { answer: "Two travel groups are recorded.", evidenceReferences: ["travel:g1", "travel:g2"] } },
      submissionScheduleAnswers: { "submission.when": { answer: "Scheduled for the recommended window.", evidenceReferences: ["schedule:s1"] } },
      documentStatusAnswers: { "document.missing": { answer: "Child 1 needs parental consent.", evidenceReferences: ["requirement:r1"] } },
    };
    expect(answerVisaAssistant("applicant.requirements.spouse", extended)).toMatchObject({ state: "ANSWERED", sourceReferences: ["evaluation:spouse"] });
    expect(answerVisaAssistant("travel.together", extended).answer).toContain("Two travel groups");
    expect(answerVisaAssistant("submission.when", extended).answer).toContain("Scheduled");
    expect(answerVisaAssistant("document.missing", extended).answer).toContain("parental consent");
  });

  it("requires authentication for case-specific travel answers", () => {
    expect(answerVisaAssistant("travel.together", { ...empty, travelPartyAnswers: { "travel.together": { answer: "Private", evidenceReferences: ["travel:g1"] } } }).state).toBe("AUTHENTICATION_REQUIRED");
  });
});
