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
};

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
  };
}
