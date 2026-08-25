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
});
