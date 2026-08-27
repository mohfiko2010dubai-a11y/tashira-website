export const AI_GOVERNANCE_VERSION = "AI_ADVISORY_BOUNDARY_V1" as const;

export type AiTask =
  | "DOCUMENT_EXTRACTION"
  | "DOCUMENT_PRESCREEN"
  | "TICKET_EXTRACTION"
  | "TICKET_PRESCREEN"
  | "CASE_SUMMARY"
  | "ELIGIBILITY_DECISION"
  | "RULE_ACTIVATION"
  | "FINAL_SUBMISSION_OUTCOME";

const advisoryTasks: ReadonlySet<AiTask> = new Set([
  "DOCUMENT_EXTRACTION", "DOCUMENT_PRESCREEN", "TICKET_EXTRACTION", "TICKET_PRESCREEN", "CASE_SUMMARY",
]);

export type AiAdvisoryAuthorization = {
  governanceVersion: typeof AI_GOVERNANCE_VERSION;
  task: AiTask;
  authority: "ADVISORY_ONLY";
  finalDecisionAuthority: "DETERMINISTIC_RULES_OR_HUMAN";
};

export function authorizeAiAdvisoryTask(task: AiTask): AiAdvisoryAuthorization {
  if (!advisoryTasks.has(task)) throw new Error(`AI_DECISION_AUTHORITY_DENIED:${task}`);
  return {
    governanceVersion: AI_GOVERNANCE_VERSION,
    task,
    authority: "ADVISORY_ONLY",
    finalDecisionAuthority: "DETERMINISTIC_RULES_OR_HUMAN",
  };
}
