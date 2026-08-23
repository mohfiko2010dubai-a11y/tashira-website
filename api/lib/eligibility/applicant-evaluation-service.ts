import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import { InMemoryRuleRegistryRepository } from "../rules/rule-repository";
import { createEvaluationEvidence, type EvaluationEvidenceSnapshot } from "./evaluation-evidence";
import { evaluateEligibility, type EligibilityProfile } from "./eligibility-engine";
import { InMemoryEligibilitySnapshotRepository } from "./snapshot-repository";

export type ApplicantEvaluationServiceResult =
  | { status: "FEATURE_DISABLED" }
  | { status: "EVALUATED"; snapshot: EvaluationEvidenceSnapshot };

export function evaluateApplicantWithRegistry(input: {
  featureContext: FeatureFlagContext;
  featureFlags: readonly FeatureFlagRecord[];
  registry: InMemoryRuleRegistryRepository;
  snapshots: InMemoryEligibilitySnapshotRepository;
  evaluationId: string;
  selectionEventId: string;
  applicationId: number;
  applicantId: number;
  profile: EligibilityProfile;
  evaluatedAt: Date;
  actorReference: string;
  reevaluationReason?: string | null;
  supersedesEvaluationId?: string | null;
  selectAsCurrent: boolean;
}): ApplicantEvaluationServiceResult {
  if (!isOperationsFlagEnabled("VISA_RULES_EVALUATION", input.featureContext, input.featureFlags)) {
    return { status: "FEATURE_DISABLED" };
  }
  const rules = input.registry.activeForRoute(input.profile.routeCode);
  const result = evaluateEligibility({ profile: input.profile, rules, evaluatedAt: input.evaluatedAt });
  const snapshot = createEvaluationEvidence({
    evaluationId: input.evaluationId,
    applicationId: input.applicationId,
    applicantId: input.applicantId,
    selectedRoute: input.profile.routeCode,
    evaluatedAt: input.evaluatedAt,
    result,
    reevaluationReason: input.reevaluationReason,
    supersedesEvaluationId: input.supersedesEvaluationId,
  });
  input.snapshots.append(snapshot);
  if (input.selectAsCurrent) {
    input.snapshots.select({
      id: input.selectionEventId,
      applicationId: input.applicationId,
      applicantId: input.applicantId,
      evaluationId: input.evaluationId,
      reason: input.reevaluationReason || "Initial reviewed evaluation",
      selectedBy: input.actorReference,
      selectedAt: input.evaluatedAt.toISOString(),
    });
  }
  return { status: "EVALUATED", snapshot };
}
