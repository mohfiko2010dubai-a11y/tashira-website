import { describe, expect, it } from "vitest";
import { authorizeAiAdvisoryTask } from "./decision-boundary";

describe("AI decision authority boundary", () => {
  it.each(["DOCUMENT_EXTRACTION", "DOCUMENT_PRESCREEN", "TICKET_EXTRACTION", "TICKET_PRESCREEN", "CASE_SUMMARY"] as const)(
    "allows advisory task %s without final authority",
    (task) => expect(authorizeAiAdvisoryTask(task)).toMatchObject({ task, authority: "ADVISORY_ONLY", finalDecisionAuthority: "DETERMINISTIC_RULES_OR_HUMAN" }),
  );

  it.each(["ELIGIBILITY_DECISION", "RULE_ACTIVATION", "FINAL_SUBMISSION_OUTCOME"] as const)(
    "denies prohibited decision task %s",
    (task) => expect(() => authorizeAiAdvisoryTask(task)).toThrow(`AI_DECISION_AUTHORITY_DENIED:${task}`),
  );
});
