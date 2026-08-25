import type { EligibilityProfile, EligibilityRule } from "../eligibility/eligibility-engine";
import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { DynamicRequirementView } from "../requirements/dynamic-requirements";
import type { SubmissionScheduleSnapshot } from "../travel/submission-scheduler";
import type { TravelQuestion } from "../travel/travel-questionnaire";
import { runCustomerPrecheck, type CustomerPrecheckResult } from "./customer-precheck";
import { buildDynamicCustomerApplicationPlan, type CustomerApplicantIdentity, type CustomerTravelGroup, type DynamicCustomerApplicationPlan } from "./dynamic-application-plan";

export function buildDynamicCustomerApplicationBehindFlags(input: {
  context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  applicationId: number;
  identities: readonly CustomerApplicantIdentity[];
  requirements: DynamicRequirementView;
  travelQuestions: readonly TravelQuestion[];
  travelGroups: readonly CustomerTravelGroup[];
  schedules: readonly SubmissionScheduleSnapshot[];
}): DynamicCustomerApplicationPlan | null {
  const requiredFlags = ["VISA_RULES_EVALUATION", "DYNAMIC_REQUIREMENTS", "DYNAMIC_CUSTOMER_APPLICATION"] as const;
  if (requiredFlags.some((flag) => !isOperationsFlagEnabled(flag, input.context, input.flags))) return null;
  return buildDynamicCustomerApplicationPlan(input);
}

export function runCustomerPrecheckBehindFlag(input: {
  context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  profile: EligibilityProfile;
  approvedPublicRules: readonly EligibilityRule[];
  evaluatedAt: Date;
}): CustomerPrecheckResult | null {
  if (!isOperationsFlagEnabled("CUSTOMER_PRECHECK", input.context, input.flags)) return null;
  return runCustomerPrecheck(input);
}
