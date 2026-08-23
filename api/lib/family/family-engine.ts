import type { EligibilityState } from "../eligibility/eligibility-engine";
import type { EvaluationEvidenceSnapshot } from "../eligibility/evaluation-evidence";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";

export type FamilyRelationship =
  | "LEAD_APPLICANT"
  | "SPOUSE"
  | "CHILD"
  | "PARENT"
  | "SIBLING"
  | "OTHER";

export type FamilyMember = {
  applicantId: number;
  relationship: FamilyRelationship;
};

export type ApplicantRequirementSet = {
  applicantId: number;
  evaluationId: string;
  ruleVersions: EvaluationEvidenceSnapshot["matchedRuleVersions"];
  eligibilityState: EligibilityState;
  requiredDocuments: readonly { applicantId: number; code: string; evaluationId: string }[];
  conditionalDocuments: readonly {
    applicantId: number;
    code: string;
    reason: string;
    evaluationId: string;
    when?: { questionCode: string; operator: "EQUALS" | "IN"; value: string | readonly string[] };
  }[];
  warnings: readonly string[];
};

export type FamilyEvaluation = {
  applicationId: number;
  finalEligibilityState: EligibilityState;
  manualReviewReasons: readonly string[];
  members: readonly ApplicantRequirementSet[];
};

function aggregateState(states: readonly EligibilityState[]): EligibilityState {
  if (states.includes("RULE_CONFLICT")) return "RULE_CONFLICT";
  if (states.includes("HUMAN_REVIEW_REQUIRED")) return "HUMAN_REVIEW_REQUIRED";
  if (states.includes("INELIGIBLE")) return "INELIGIBLE";
  return "ELIGIBLE";
}

export function aggregateFamilyEvaluations(input: {
  applicationId: number;
  members: readonly FamilyMember[];
  snapshots: InMemoryEligibilitySnapshotRepository;
}): FamilyEvaluation {
  if (input.members.length === 0) throw new Error("Family must contain at least one applicant");
  const applicantIds = input.members.map((member) => member.applicantId);
  if (new Set(applicantIds).size !== applicantIds.length) throw new Error("Family applicant IDs must be unique");
  if (input.members.filter((member) => member.relationship === "LEAD_APPLICANT").length !== 1) {
    throw new Error("Family must contain exactly one lead applicant");
  }

  const manualReviewReasons: string[] = [];
  const members = [...input.members]
    .sort((left, right) => left.applicantId - right.applicantId)
    .map((member): ApplicantRequirementSet => {
      const snapshot = input.snapshots.current(input.applicationId, member.applicantId);
      if (!snapshot) {
        manualReviewReasons.push(`MISSING_CURRENT_EVALUATION:${member.applicantId}`);
        return {
          applicantId: member.applicantId,
          evaluationId: "",
          ruleVersions: [],
          eligibilityState: "HUMAN_REVIEW_REQUIRED",
          requiredDocuments: [],
          conditionalDocuments: [],
          warnings: ["Current eligibility evaluation is required"],
        };
      }
      if (snapshot.applicationId !== input.applicationId || snapshot.applicantId !== member.applicantId) {
        throw new Error("Family evaluation snapshot ownership mismatch");
      }
      if (snapshot.manualReviewReason) {
        manualReviewReasons.push(`${member.applicantId}:${snapshot.manualReviewReason}`);
      }
      return {
        applicantId: member.applicantId,
        evaluationId: snapshot.evaluationId,
        ruleVersions: snapshot.matchedRuleVersions,
        eligibilityState: snapshot.eligibilityState,
        requiredDocuments: snapshot.requiredDocuments.map((code) => ({
          applicantId: member.applicantId,
          code,
          evaluationId: snapshot.evaluationId,
        })),
        conditionalDocuments: snapshot.conditionalDocuments.map((document) => ({
          applicantId: member.applicantId,
          code: document.code,
          reason: document.reason,
          evaluationId: snapshot.evaluationId,
          when: document.when,
        })),
        warnings: snapshot.warnings,
      };
    });

  return {
    applicationId: input.applicationId,
    finalEligibilityState: aggregateState(members.map((member) => member.eligibilityState)),
    manualReviewReasons: [...new Set(manualReviewReasons)].sort((left, right) => left.localeCompare(right)),
    members,
  };
}
