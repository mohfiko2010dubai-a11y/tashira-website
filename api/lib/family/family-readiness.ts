import type { EligibilityState } from "../eligibility/eligibility-engine";

export type ApplicantReadinessState =
  | "READY"
  | "WAITING_FOR_DOCUMENTS"
  | "MANUAL_REVIEW_REQUIRED"
  | "NOT_ELIGIBLE"
  | "VISA_NOT_REQUIRED"
  | "VISA_ON_ARRIVAL"
  | "CONDITIONAL";

export type TravelOutcome = "VISA_NOT_REQUIRED" | "VISA_ON_ARRIVAL";
export type RequirementInstanceState =
  | "MISSING"
  | "UPLOADED"
  | "VALIDATED"
  | "WAIVED"
  | "CONDITIONAL_PENDING";

export type ApplicantReadinessInput = {
  applicantId: number;
  evaluationId: string;
  eligibilityState: EligibilityState;
  travelOutcome?: TravelOutcome;
  routeCompatible: boolean;
  requirements: readonly {
    applicantId: number;
    code: string;
    critical: boolean;
    state: RequirementInstanceState;
    customerAction?: string;
  }[];
  manualReviewReason?: string;
};

export type FamilyReadinessResult = {
  family_readiness_state: "READY_FOR_SUBMISSION" | "NOT_READY";
  blocking_applicant_ids: readonly number[];
  blocking_reasons: readonly { applicant_id: number; code: string; reason: string }[];
  member_states: readonly {
    applicant_id: number;
    evaluation_id: string;
    readiness_state: ApplicantReadinessState;
  }[];
  required_customer_actions: readonly { applicant_id: number; action: string }[];
  manual_review_required: boolean;
  route_compatibility_warnings: readonly { applicant_id: number; warning: string }[];
};

function memberState(member: ApplicantReadinessInput): ApplicantReadinessState {
  if (member.eligibilityState === "RULE_CONFLICT" || member.eligibilityState === "HUMAN_REVIEW_REQUIRED") {
    return "MANUAL_REVIEW_REQUIRED";
  }
  if (member.travelOutcome) return member.travelOutcome;
  if (member.eligibilityState === "INELIGIBLE" || !member.routeCompatible) return "NOT_ELIGIBLE";
  if (member.requirements.some((requirement) => requirement.state === "MISSING")) {
    return "WAITING_FOR_DOCUMENTS";
  }
  if (member.requirements.some((requirement) => requirement.state === "CONDITIONAL_PENDING")) {
    return "CONDITIONAL";
  }
  if (member.requirements.some((requirement) => requirement.state === "UPLOADED")) {
    return "WAITING_FOR_DOCUMENTS";
  }
  return "READY";
}

export function deriveFamilyReadiness(members: readonly ApplicantReadinessInput[]): FamilyReadinessResult {
  if (members.length === 0) throw new Error("Family readiness requires at least one applicant");
  const ids = members.map((member) => member.applicantId);
  if (new Set(ids).size !== ids.length) throw new Error("Family readiness applicant IDs must be unique");

  const ordered = [...members].sort((left, right) => left.applicantId - right.applicantId);
  for (const member of ordered) {
    if (member.requirements.some((requirement) => requirement.applicantId !== member.applicantId)) {
      throw new Error("Applicant requirement ownership mismatch");
    }
  }
  const states = ordered.map((member) => ({ member, state: memberState(member) }));
  const blockers = states.filter(({ state }) => !["READY", "VISA_NOT_REQUIRED", "VISA_ON_ARRIVAL"].includes(state));
  const blockingReasons: FamilyReadinessResult["blocking_reasons"][number][] = [];
  const actions: FamilyReadinessResult["required_customer_actions"][number][] = [];
  const warnings: FamilyReadinessResult["route_compatibility_warnings"][number][] = [];

  for (const { member, state } of states) {
    if (state === "MANUAL_REVIEW_REQUIRED") {
      blockingReasons.push({
        applicant_id: member.applicantId,
        code: member.eligibilityState === "RULE_CONFLICT" ? "RULE_CONFLICT" : "MANUAL_REVIEW_REQUIRED",
        reason: member.manualReviewReason ?? "Applicant requires human review",
      });
    } else if (state === "NOT_ELIGIBLE") {
      blockingReasons.push({ applicant_id: member.applicantId, code: "NOT_ELIGIBLE", reason: "Applicant is not eligible for the selected family route" });
      warnings.push({ applicant_id: member.applicantId, warning: "Selected family route is incompatible" });
    } else if (state === "WAITING_FOR_DOCUMENTS" || state === "CONDITIONAL") {
      for (const requirement of member.requirements.filter((item) =>
        item.state === "MISSING" || item.state === "UPLOADED" || item.state === "CONDITIONAL_PENDING")) {
        const code = requirement.state === "CONDITIONAL_PENDING"
          ? "CONDITIONAL_REQUIREMENT_PENDING"
          : requirement.critical ? "CRITICAL_DOCUMENT_MISSING" : "REQUIRED_DOCUMENT_INCOMPLETE";
        blockingReasons.push({ applicant_id: member.applicantId, code, reason: `${requirement.code} is not complete` });
        actions.push({ applicant_id: member.applicantId, action: requirement.customerAction ?? `Complete ${requirement.code}` });
      }
    }
    if (state === "VISA_NOT_REQUIRED" || state === "VISA_ON_ARRIVAL") {
      warnings.push({ applicant_id: member.applicantId, warning: state });
    }
  }

  return {
    family_readiness_state: blockers.length === 0 ? "READY_FOR_SUBMISSION" : "NOT_READY",
    blocking_applicant_ids: blockers.map(({ member }) => member.applicantId),
    blocking_reasons: blockingReasons,
    member_states: states.map(({ member, state }) => ({
      applicant_id: member.applicantId, evaluation_id: member.evaluationId, readiness_state: state,
    })),
    required_customer_actions: actions,
    manual_review_required: states.some(({ state }) => state === "MANUAL_REVIEW_REQUIRED"),
    route_compatibility_warnings: warnings,
  };
}
