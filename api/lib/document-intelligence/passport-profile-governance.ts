import type { Permission } from "../authorization/permissions";

export const passportProfileStates = ["DRAFT", "UNDER_REVIEW", "APPROVED", "ACTIVE", "SUPERSEDED", "RETIRED"] as const;
export type PassportProfileState = typeof passportProfileStates[number];
export type PassportProfileAction = "SUBMIT_FOR_REVIEW" | "APPROVE" | "ACTIVATE" | "SUPERSEDE" | "RETIRE";

const transitions: Readonly<Record<PassportProfileAction, readonly PassportProfileState[]>> = {
  SUBMIT_FOR_REVIEW: ["DRAFT"], APPROVE: ["UNDER_REVIEW"], ACTIVATE: ["APPROVED"], SUPERSEDE: ["ACTIVE"], RETIRE: ["APPROVED", "ACTIVE"],
};
const results: Readonly<Record<PassportProfileAction, PassportProfileState>> = {
  SUBMIT_FOR_REVIEW: "UNDER_REVIEW", APPROVE: "APPROVED", ACTIVATE: "ACTIVE", SUPERSEDE: "SUPERSEDED", RETIRE: "RETIRED",
};
const permissions: Readonly<Record<PassportProfileAction, Permission>> = {
  SUBMIT_FOR_REVIEW: "rule.propose", APPROVE: "rule.review", ACTIVATE: "rule.activate", SUPERSEDE: "rule.activate", RETIRE: "rule.activate",
};

export function evaluatePassportProfileTransition(input: {
  current: PassportProfileState;
  action: PassportProfileAction;
  actorPermissions: ReadonlySet<Permission>;
  environment: "DEVELOPMENT" | "TEST" | "STAGING" | "PRODUCTION";
  stagingTestOnly: boolean;
}): PassportProfileState {
  if (!input.actorPermissions.has(permissions[input.action])) throw new Error("PASSPORT_PROFILE_GOVERNANCE_ACCESS_DENIED");
  if (!transitions[input.action].includes(input.current)) throw new Error("PASSPORT_PROFILE_TRANSITION_INVALID");
  if (input.action === "ACTIVATE" && input.stagingTestOnly && input.environment === "PRODUCTION") {
    throw new Error("PASSPORT_PROFILE_STAGING_TEST_PRODUCTION_FORBIDDEN");
  }
  return results[input.action];
}
