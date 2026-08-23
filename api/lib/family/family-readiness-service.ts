import {
  isOperationsFlagEnabled,
  type FeatureFlagContext,
  type FeatureFlagRecord,
} from "../feature-flags/feature-flags";
import { deriveFamilyReadiness, type ApplicantReadinessInput, type FamilyReadinessResult } from "./family-readiness";

export function evaluateFamilyReadinessBehindFlags(input: {
  context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  members: readonly ApplicantReadinessInput[];
}): FamilyReadinessResult | null {
  const familyEnabled = isOperationsFlagEnabled("FAMILY_ENGINE", input.context, input.flags);
  const requirementsEnabled = isOperationsFlagEnabled("DYNAMIC_REQUIREMENTS", input.context, input.flags);
  if (!familyEnabled || !requirementsEnabled) return null;
  return deriveFamilyReadiness(input.members);
}
