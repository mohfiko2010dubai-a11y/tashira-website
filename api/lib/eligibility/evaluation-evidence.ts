import { createHash } from "node:crypto";
import type { EligibilityEvaluationResult } from "./eligibility-engine";

export const ELIGIBILITY_ENGINE_VERSION = "eligibility-v1" as const;

export type EvaluationEvidenceSnapshot = {
  evaluationId: string;
  applicationId: number;
  applicantId: number;
  engineVersion: typeof ELIGIBILITY_ENGINE_VERSION;
  selectedRoute: string;
  evaluatedAt: string;
  eligibilityState: EligibilityEvaluationResult["finalEligibilityState"];
  reason: string;
  reevaluationReason: string | null;
  supersedesEvaluationId: string | null;
  manualReviewReason: string | null;
  matchedRuleIds: EligibilityEvaluationResult["matchedRuleIds"];
  matchedRuleVersions: EligibilityEvaluationResult["matchedRuleVersions"];
  sourceAuthorities: EligibilityEvaluationResult["sourceAuthorities"];
  matchedRules: EligibilityEvaluationResult["matchedRules"];
  requiredDocuments: EligibilityEvaluationResult["requiredDocuments"];
  conditionalDocuments: EligibilityEvaluationResult["conditionalDocuments"];
  warnings: readonly string[];
  precedenceTrace: EligibilityEvaluationResult["matchedRules"];
  evidenceSha256: string;
  evidenceIntegrityReference: string;
};

type UnsignedSnapshot = Omit<EvaluationEvidenceSnapshot, "evidenceSha256" | "evidenceIntegrityReference">;

function canonicalJson(snapshot: UnsignedSnapshot): string {
  return JSON.stringify(snapshot);
}

export function createEvaluationEvidence(input: {
  evaluationId: string;
  applicationId: number;
  applicantId: number;
  selectedRoute: string;
  evaluatedAt: Date;
  reevaluationReason?: string | null;
  supersedesEvaluationId?: string | null;
  warnings?: readonly string[];
  result: EligibilityEvaluationResult;
}): EvaluationEvidenceSnapshot {
  const unsigned: UnsignedSnapshot = {
    evaluationId: input.evaluationId,
    applicationId: input.applicationId,
    applicantId: input.applicantId,
    engineVersion: ELIGIBILITY_ENGINE_VERSION,
    selectedRoute: input.selectedRoute,
    evaluatedAt: input.evaluatedAt.toISOString(),
    eligibilityState: input.result.finalEligibilityState,
    reason: input.result.reason,
    reevaluationReason: input.reevaluationReason ?? null,
    supersedesEvaluationId: input.supersedesEvaluationId ?? null,
    manualReviewReason: input.result.manualReviewReason,
    matchedRuleIds: input.result.matchedRuleIds,
    matchedRuleVersions: input.result.matchedRuleVersions,
    sourceAuthorities: input.result.sourceAuthorities,
    matchedRules: input.result.matchedRules,
    requiredDocuments: input.result.requiredDocuments,
    conditionalDocuments: input.result.conditionalDocuments,
    warnings: [...new Set(input.warnings ?? [])].sort((left, right) => left.localeCompare(right)),
    precedenceTrace: input.result.matchedRules,
  };
  const evidenceSha256 = createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
  return {
    ...unsigned,
    evidenceSha256,
    evidenceIntegrityReference: `sha256:${evidenceSha256}`,
  };
}

export function verifyEvaluationEvidence(snapshot: EvaluationEvidenceSnapshot): boolean {
  const { evidenceSha256, evidenceIntegrityReference, ...unsigned } = snapshot;
  const expected = createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
  return expected === evidenceSha256 && evidenceIntegrityReference === `sha256:${expected}`;
}
