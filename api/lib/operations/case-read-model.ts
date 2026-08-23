import type { AuthorizationResource, SupplierFinancialView, SupplierOperationalView } from "../authorization/policy";
import type { EvaluationEvidenceSnapshot } from "../eligibility/evaluation-evidence";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";
import { adaptLegacyFamily } from "../family/legacy-family-adapter";
import { deriveFamilyReadiness, type FamilyReadinessResult, type TravelOutcome } from "../family/family-readiness";
import { InMemoryFamilyPersistenceRepository, type FamilyRelationshipEvent } from "../family/family-persistence";

export type OperationsCaseSource = {
  summary: {
    applicationId: number;
    reference: string;
    status: string;
    createdAt: string;
    assignedActorId?: string;
    teamId?: number;
    departmentId?: number;
    legacy: boolean;
  };
  applicants: readonly {
    applicantId: number;
    applicantIndex: number;
    displayName: string;
    nationality: string | null;
    residenceCountry: string | null;
    travelOutcome?: TravelOutcome;
    routeCompatible: boolean;
  }[];
  documents: readonly {
    documentId: number;
    applicantId: number;
    code: string;
    readiness: "MISSING" | "UPLOADED" | "VALIDATED" | "REJECTED";
  }[];
  supplier: SupplierFinancialView | null;
  operationalHistory: readonly { id: string; event: string; actorType: string; occurredAt: string }[];
};

export type OperationsCaseReadModel = {
  mode: "CURRENT" | "LEGACY_NOT_EVALUATED";
  summary: OperationsCaseSource["summary"];
  relationships: readonly FamilyRelationshipEvent[] | ReturnType<typeof adaptLegacyFamily>["members"];
  applicants: readonly {
    applicantId: number;
    applicantIndex: number;
    displayName: string;
    nationality: string | null;
    residenceCountry: string | null;
    currentEvaluation: EvaluationEvidenceSnapshot | null;
    previousEvaluations: readonly EvaluationEvidenceSnapshot[];
    evaluationChange: {
      previousEvaluationId: string | null;
      currentEvaluationId: string;
      changedFields: readonly string[];
      reason: string | null;
    } | null;
    currentRuleVersions: EvaluationEvidenceSnapshot["matchedRuleVersions"];
    dynamicRequirements: ReturnType<InMemoryFamilyPersistenceRepository["requirements"]>;
    documents: OperationsCaseSource["documents"];
    manualReviewRequired: boolean;
  }[];
  familyReadiness: FamilyReadinessResult;
  supplier: SupplierOperationalView | SupplierFinancialView | null;
  operationalHistory: OperationsCaseSource["operationalHistory"];
  legacyWarnings: readonly string[];
};

function changedFields(previous: EvaluationEvidenceSnapshot | null, current: EvaluationEvidenceSnapshot): string[] {
  if (!previous) return [];
  const fields: Array<keyof EvaluationEvidenceSnapshot> = [
    "eligibilityState", "selectedRoute", "matchedRuleVersions", "sourceAuthorities",
    "requiredDocuments", "conditionalDocuments", "warnings", "manualReviewReason",
  ];
  return fields.filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(current[field]));
}

export function caseAuthorizationResource(source: OperationsCaseSource): AuthorizationResource {
  return {
    assignedActorId: source.summary.assignedActorId,
    teamId: source.summary.teamId,
    departmentId: source.summary.departmentId,
  };
}

export function buildOperationsCaseReadModel(input: {
  source: OperationsCaseSource;
  snapshots: InMemoryEligibilitySnapshotRepository;
  family: InMemoryFamilyPersistenceRepository;
  supplierProjection: SupplierOperationalView | SupplierFinancialView | null;
}): OperationsCaseReadModel {
  const applicantIds = input.source.applicants.map((applicant) => applicant.applicantId);
  if (new Set(applicantIds).size !== applicantIds.length) throw new Error("Operations case applicant IDs must be unique");
  if (input.source.documents.some((document) => !applicantIds.includes(document.applicantId))) {
    throw new Error("Document ownership is outside this case");
  }

  const legacy = input.source.summary.legacy;
  const legacyGraph = legacy ? adaptLegacyFamily(input.source.applicants) : null;
  const applicants = [...input.source.applicants]
    .sort((left, right) => left.applicantIndex - right.applicantIndex)
    .map((applicant) => {
      const history = legacy ? [] : input.snapshots.history(input.source.summary.applicationId, applicant.applicantId);
      const current = legacy ? null : input.snapshots.current(input.source.summary.applicationId, applicant.applicantId);
      const previous = current?.supersedesEvaluationId ? input.snapshots.get(current.supersedesEvaluationId) : null;
      const requirements = current
        ? input.family.requirements(input.source.summary.applicationId, applicant.applicantId, current.evaluationId)
        : [];
      return {
        ...applicant,
        currentEvaluation: current,
        previousEvaluations: history.filter((snapshot) => snapshot.evaluationId !== current?.evaluationId),
        evaluationChange: current ? {
          previousEvaluationId: previous?.evaluationId ?? null,
          currentEvaluationId: current.evaluationId,
          changedFields: changedFields(previous, current),
          reason: current.reevaluationReason,
        } : null,
        currentRuleVersions: current?.matchedRuleVersions ?? [],
        dynamicRequirements: requirements,
        documents: input.source.documents.filter((document) => document.applicantId === applicant.applicantId),
        manualReviewRequired: current === null || ["RULE_CONFLICT", "HUMAN_REVIEW_REQUIRED"].includes(current.eligibilityState),
      };
    });

  const familyReadiness = deriveFamilyReadiness(applicants.map((applicant) => ({
    applicantId: applicant.applicantId,
    evaluationId: applicant.currentEvaluation?.evaluationId ?? "",
    eligibilityState: applicant.currentEvaluation?.eligibilityState ?? "HUMAN_REVIEW_REQUIRED",
    travelOutcome: applicant.travelOutcome,
    routeCompatible: applicant.routeCompatible,
    manualReviewReason: applicant.currentEvaluation?.manualReviewReason ?? (legacy ? "LEGACY_NOT_EVALUATED" : "CURRENT_EVALUATION_MISSING"),
    requirements: applicant.dynamicRequirements.map(({ instance, currentState }) => ({
      applicantId: applicant.applicantId,
      code: instance.code,
      critical: instance.critical,
      state: currentState ?? "MISSING",
    })),
  })));

  return {
    mode: legacy ? "LEGACY_NOT_EVALUATED" : "CURRENT",
    summary: structuredClone(input.source.summary),
    relationships: legacyGraph?.members ?? input.family.currentRelationships(input.source.summary.applicationId),
    applicants,
    familyReadiness,
    supplier: input.supplierProjection,
    operationalHistory: structuredClone(input.source.operationalHistory),
    legacyWarnings: legacyGraph?.warnings ?? [],
  };
}
