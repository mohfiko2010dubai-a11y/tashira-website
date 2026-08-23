import { createHash } from "node:crypto";
import type { EligibilityEvaluationResult } from "./eligibility-engine";

export const ELIGIBILITY_ENGINE_VERSION = "eligibility-v1" as const;

export type EvaluationEvidenceSnapshot = {
  engineVersion: typeof ELIGIBILITY_ENGINE_VERSION;
  routeCode: string;
  evaluatedAt: string;
  finalEligibilityState: EligibilityEvaluationResult["finalEligibilityState"];
  reason: string;
  manualReviewReason: string | null;
  matchedRules: EligibilityEvaluationResult["matchedRules"];
  requiredDocuments: EligibilityEvaluationResult["requiredDocuments"];
  conditionalDocuments: EligibilityEvaluationResult["conditionalDocuments"];
  evidenceSha256: string;
};

type UnsignedSnapshot = Omit<EvaluationEvidenceSnapshot, "evidenceSha256">;

function canonicalJson(snapshot: UnsignedSnapshot): string {
  return JSON.stringify(snapshot);
}

export function createEvaluationEvidence(input: {
  routeCode: string;
  evaluatedAt: Date;
  result: EligibilityEvaluationResult;
}): EvaluationEvidenceSnapshot {
  const unsigned: UnsignedSnapshot = {
    engineVersion: ELIGIBILITY_ENGINE_VERSION,
    routeCode: input.routeCode,
    evaluatedAt: input.evaluatedAt.toISOString(),
    finalEligibilityState: input.result.finalEligibilityState,
    reason: input.result.reason,
    manualReviewReason: input.result.manualReviewReason,
    matchedRules: input.result.matchedRules,
    requiredDocuments: input.result.requiredDocuments,
    conditionalDocuments: input.result.conditionalDocuments,
  };
  return {
    ...unsigned,
    evidenceSha256: createHash("sha256").update(canonicalJson(unsigned)).digest("hex"),
  };
}

export function verifyEvaluationEvidence(snapshot: EvaluationEvidenceSnapshot): boolean {
  const { evidenceSha256, ...unsigned } = snapshot;
  const expected = createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
  return expected === evidenceSha256;
}
