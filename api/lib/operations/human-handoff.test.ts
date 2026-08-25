import { describe, expect, it } from "vitest";
import { createHumanHandoff } from "./human-handoff";
const base = { handoffId: "h1", conversationId: "c1", applicationId: 1, createdAt: "2026-08-25T12:00:00Z", trigger: "RULE_CONFLICT" as const, customerQuestion: "Can my family travel separately?", aiSummary: "Two applicants have different rule outcomes.", applicantIds: [1, 2], travelGroupIds: ["g1", "g2"], ruleReferences: ["rule:r1@1"], requirementReferences: ["req:1"], documentReferences: ["doc:1"], schedulerReference: "schedule:1", suggestedReply: "A specialist will review your travel groups.", auditReference: "audit:1" };
describe("human handoff", () => {
  it("creates an auditable unassigned conversation preserving case context", () => expect(createHumanHandoff(base)).toMatchObject({ state: "UNASSIGNED", applicantIds: [1, 2], trigger: "RULE_CONFLICT" }));
  it("rejects missing or duplicate applicant scope", () => expect(() => createHumanHandoff({ ...base, applicantIds: [1, 1] })).toThrow("HUMAN_HANDOFF_APPLICANT_SCOPE_INVALID"));
});
