import type { Permission } from "../authorization/permissions";

export type RuleVersionStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "RETIRED" | "REJECTED";
export type RuleGovernanceAction = "SUBMIT_FOR_REVIEW" | "APPROVE" | "REJECT" | "ACTIVATE" | "RETIRE";

const transitions: Readonly<Record<RuleGovernanceAction, readonly RuleVersionStatus[]>> = {
  SUBMIT_FOR_REVIEW: ["DRAFT"],
  APPROVE: ["UNDER_REVIEW"],
  REJECT: ["UNDER_REVIEW"],
  ACTIVATE: ["APPROVED"],
  RETIRE: ["ACTIVE"],
};

const nextStatus: Readonly<Record<RuleGovernanceAction, RuleVersionStatus>> = {
  SUBMIT_FOR_REVIEW: "UNDER_REVIEW",
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  ACTIVATE: "ACTIVE",
  RETIRE: "RETIRED",
};

const requiredPermission: Readonly<Record<RuleGovernanceAction, Permission>> = {
  SUBMIT_FOR_REVIEW: "rule.propose",
  APPROVE: "rule.review",
  REJECT: "rule.review",
  ACTIVATE: "rule.activate",
  RETIRE: "rule.activate",
};

export type RuleTransitionDecision = {
  allowed: boolean;
  resultingStatus: RuleVersionStatus;
  reason: "ALLOWED" | "PERMISSION_DENIED" | "INVALID_TRANSITION" | "OWNER_GATE_REQUIRED";
};

export function evaluateRuleTransition(input: {
  currentStatus: RuleVersionStatus;
  action: RuleGovernanceAction;
  permissions: ReadonlySet<Permission>;
  environment: "DEVELOPMENT" | "TEST" | "STAGING" | "PRODUCTION";
  ownerActivationApproved: boolean;
}): RuleTransitionDecision {
  if (!input.permissions.has(requiredPermission[input.action])) {
    return { allowed: false, resultingStatus: input.currentStatus, reason: "PERMISSION_DENIED" };
  }
  if (!transitions[input.action].includes(input.currentStatus)) {
    return { allowed: false, resultingStatus: input.currentStatus, reason: "INVALID_TRANSITION" };
  }
  if (input.environment === "PRODUCTION" && input.action === "ACTIVATE" && !input.ownerActivationApproved) {
    return { allowed: false, resultingStatus: input.currentStatus, reason: "OWNER_GATE_REQUIRED" };
  }
  return { allowed: true, resultingStatus: nextStatus[input.action], reason: "ALLOWED" };
}
