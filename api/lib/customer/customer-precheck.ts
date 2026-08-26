import type { EligibilityEvaluationResult, EligibilityProfile, EligibilityRule } from "../eligibility/eligibility-engine";
import { evaluateEligibility } from "../eligibility/eligibility-engine";

export type CustomerPrecheckResult = {
  outcome: "LIKELY_ELIGIBLE" | "LIKELY_NOT_ELIGIBLE" | "HUMAN_REVIEW_REQUIRED";
  routeCode: string;
  requiredDocumentCodes: readonly string[];
  conditionalDocumentCodes: readonly string[];
  warnings: readonly string[];
  disclaimer: string;
  ruleEvidence: EligibilityEvaluationResult["matchedRuleVersions"];
  operationalRequirements: readonly string[];
  travelPartyConditions: readonly string[];
  ticketRequirementCodes: readonly string[];
  submissionTimingWarnings: readonly string[];
  sourceVerificationStatus: "VERIFIED" | "NOT_RESEARCHED" | "HUMAN_REVIEW_REQUIRED";
};

const TICKET_CODES = new Set(["OUTBOUND_TICKET", "RETURN_TICKET", "ONWARD_TICKET", "ROUND_TRIP_TICKET", "FAMILY_BOOKING"]);

export function runCustomerPrecheck(input: {
  profile: EligibilityProfile;
  approvedPublicRules: readonly EligibilityRule[];
  evaluatedAt: Date;
}): CustomerPrecheckResult {
  const result = evaluateEligibility({ profile: input.profile, rules: input.approvedPublicRules, evaluatedAt: input.evaluatedAt });
  const outcome = result.finalEligibilityState === "ELIGIBLE"
    ? "LIKELY_ELIGIBLE"
    : result.finalEligibilityState === "INELIGIBLE"
      ? "LIKELY_NOT_ELIGIBLE"
      : "HUMAN_REVIEW_REQUIRED";
  return {
    outcome,
    routeCode: input.profile.routeCode,
    requiredDocumentCodes: result.requiredDocuments,
    conditionalDocumentCodes: [...new Set(result.conditionalDocuments.map(({ code }) => code))].sort(),
    warnings: result.manualReviewReason ? [result.manualReviewReason] : [],
    disclaimer: "This pre-check is guidance only. It is not a visa approval or a guarantee of government acceptance.",
    ruleEvidence: result.matchedRuleVersions,
    operationalRequirements: [...new Set(result.matchedRules
      .filter(({ classification }) => classification === "OPERATIONAL")
      .map(({ reason }) => reason))].sort(),
    travelPartyConditions: result.matchedRules
      .filter(({ layer }) => layer === "FAMILY_OVERLAY" || layer === "TRAVEL_PARTY_OVERLAY")
      .map(({ reason }) => reason),
    ticketRequirementCodes: [...new Set([...result.requiredDocuments, ...result.conditionalDocuments.map(({ code }) => code)]
      .filter((code) => TICKET_CODES.has(code)))].sort(),
    submissionTimingWarnings: result.matchedRules
      .filter(({ layer }) => layer === "SUBMISSION_TIMING_OVERLAY")
      .map(({ reason }) => reason),
    sourceVerificationStatus: result.matchedRules.length === 0
      ? "NOT_RESEARCHED"
      : result.finalEligibilityState === "RULE_CONFLICT" || result.finalEligibilityState === "HUMAN_REVIEW_REQUIRED"
        ? "HUMAN_REVIEW_REQUIRED" : "VERIFIED",
  };
}
