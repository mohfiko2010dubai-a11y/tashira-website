export type HandoffTrigger = "LOW_CONFIDENCE" | "RULE_CONFLICT" | "CUSTOMER_REQUEST" | "COMPLAINT" | "REJECTION" | "REFUND_DISPUTE" | "UNUSUAL_FAMILY_TRAVEL" | "POST_SUBMISSION_TRAVEL_CHANGE" | "SENSITIVE_EXCEPTION";
export type HumanHandoff = {
  handoffId: string; conversationId: string; applicationId: number; createdAt: string; trigger: HandoffTrigger;
  customerQuestion: string; aiSummary: string; applicantIds: readonly number[]; travelGroupIds: readonly string[];
  ruleReferences: readonly string[]; requirementReferences: readonly string[]; documentReferences: readonly string[];
  schedulerReference: string | null; suggestedReply: string | null; state: "UNASSIGNED"; auditReference: string;
};

export function createHumanHandoff(input: Omit<HumanHandoff, "state">): HumanHandoff {
  if (!input.handoffId.trim() || !input.conversationId.trim() || !input.customerQuestion.trim() || !input.aiSummary.trim() || !input.auditReference.trim()) throw new Error("HUMAN_HANDOFF_EVIDENCE_REQUIRED");
  if (Number.isNaN(Date.parse(input.createdAt))) throw new Error("HUMAN_HANDOFF_TIMESTAMP_INVALID");
  if (input.applicantIds.length === 0 || new Set(input.applicantIds).size !== input.applicantIds.length) throw new Error("HUMAN_HANDOFF_APPLICANT_SCOPE_INVALID");
  return { ...input, applicantIds: [...input.applicantIds], travelGroupIds: [...new Set(input.travelGroupIds)], ruleReferences: [...new Set(input.ruleReferences)], requirementReferences: [...new Set(input.requirementReferences)], documentReferences: [...new Set(input.documentReferences)], state: "UNASSIGNED" };
}
