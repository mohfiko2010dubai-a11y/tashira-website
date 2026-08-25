import type { RegulatoryProposal } from "./regulatory-watcher";

export type RegulatoryImpactArea = "ELIGIBILITY" | "NATIONALITY" | "RESIDENCE" | "DOCUMENTS" | "MINOR_RULES" | "FAMILY" | "TRAVEL_PARTY" | "TICKETS" | "ENTRY_VALIDITY" | "STAY_DURATION" | "SUBMISSION_SCHEDULER" | "DYNAMIC_QUESTIONS" | "CUSTOMER_FORM" | "VISA_ASSISTANT" | "ACTIVE_APPLICATIONS";
export type RegulatoryChangeState = "NEW" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CONFLICT" | "SOURCE_FAILURE";
export type RegulatoryChange = {
  proposal: RegulatoryProposal; state: RegulatoryChangeState; proposedRuleVersion: number; currentRuleVersion: number | null;
  impactAreas: readonly RegulatoryImpactArea[]; impactReasons: readonly string[]; reviewedBy: number | null; reviewedAt: string | null;
  activationAllowed: false; historicalMutationAllowed: false;
};

export function createRegulatoryChange(input: Omit<RegulatoryChange, "state" | "reviewedBy" | "reviewedAt" | "activationAllowed" | "historicalMutationAllowed">): RegulatoryChange {
  if (input.proposedRuleVersion <= (input.currentRuleVersion ?? 0) || input.impactAreas.length === 0 || input.impactReasons.length === 0) throw new Error("REGULATORY_IMPACT_EVIDENCE_REQUIRED");
  return { ...input, impactAreas: [...new Set(input.impactAreas)].sort(), impactReasons: [...new Set(input.impactReasons)].sort(), state: "NEW", reviewedBy: null, reviewedAt: null, activationAllowed: false, historicalMutationAllowed: false };
}

export function reviewRegulatoryChange(input: { change: RegulatoryChange; reviewerId: number; reviewedAt: string; decision: "START_REVIEW" | "APPROVE" | "REJECT" | "MARK_CONFLICT" }): RegulatoryChange {
  if (!Number.isSafeInteger(input.reviewerId) || Number.isNaN(Date.parse(input.reviewedAt))) throw new Error("REGULATORY_REVIEW_EVIDENCE_REQUIRED");
  const expected: Record<typeof input.decision, readonly RegulatoryChangeState[]> = { START_REVIEW: ["NEW"], APPROVE: ["UNDER_REVIEW"], REJECT: ["UNDER_REVIEW"], MARK_CONFLICT: ["NEW", "UNDER_REVIEW"] };
  if (!expected[input.decision].includes(input.change.state)) throw new Error("REGULATORY_REVIEW_TRANSITION_INVALID");
  const state: RegulatoryChangeState = input.decision === "START_REVIEW" ? "UNDER_REVIEW" : input.decision === "APPROVE" ? "APPROVED" : input.decision === "REJECT" ? "REJECTED" : "CONFLICT";
  return { ...input.change, state, reviewedBy: input.reviewerId, reviewedAt: input.reviewedAt, activationAllowed: false, historicalMutationAllowed: false };
}
