import { createEvaluationEvidence, type EvaluationEvidenceSnapshot } from "../../api/lib/eligibility/evaluation-evidence";
import { evaluateEligibility, type EligibilityRule, type RuleEligibilityEffect } from "../../api/lib/eligibility/eligibility-engine";
import { deriveFamilyReadiness, type RequirementInstanceState } from "../../api/lib/family/family-readiness";
import type { OperationsCaseReadModel } from "../../api/lib/operations/case-read-model";

export const LOCAL_ACCEPTANCE_APPLICATION_ID = 91001;

type ApplicantFixture = {
  applicantId: number;
  applicantIndex: number;
  displayName: string;
  nationality: string;
  residenceCountry: string;
  ruleId: string;
  effect: RuleEligibilityEffect;
  documentCode: string;
  documentState: RequirementInstanceState;
  documentReadiness: "MISSING" | "UPLOADED" | "VALIDATED" | "REJECTED";
  manualReason?: string;
};

const FAMILY: readonly ApplicantFixture[] = [
  { applicantId: 91011, applicantIndex: 0, displayName: "Omar Hassan (Father)", nationality: "Egypt", residenceCountry: "Saudi Arabia", ruleId: "EG-GCC-FAMILY", effect: "ELIGIBLE", documentCode: "PASSPORT_AND_GCC_RESIDENCE", documentState: "VALIDATED", documentReadiness: "VALIDATED" },
  { applicantId: 91012, applicantIndex: 1, displayName: "Aisha Khan (Mother)", nationality: "Pakistan", residenceCountry: "Saudi Arabia", ruleId: "PK-GCC-FAMILY", effect: "ELIGIBLE", documentCode: "PASSPORT", documentState: "VALIDATED", documentReadiness: "VALIDATED" },
  { applicantId: 91013, applicantIndex: 2, displayName: "Arjun Hassan (Child 1)", nationality: "India", residenceCountry: "Saudi Arabia", ruleId: "IN-MINOR-FAMILY", effect: "ELIGIBLE", documentCode: "MINOR_BIRTH_CERTIFICATE", documentState: "MISSING", documentReadiness: "MISSING" },
  { applicantId: 91014, applicantIndex: 3, displayName: "Maya Hassan (Child 2)", nationality: "Philippines", residenceCountry: "Saudi Arabia", ruleId: "PH-MINOR-REVIEW", effect: "HUMAN_REVIEW_REQUIRED", documentCode: "GUARDIAN_CONSENT", documentState: "VALIDATED", documentReadiness: "VALIDATED", manualReason: "Minor residence evidence requires authorized human review" },
];

function rule(applicant: ApplicantFixture, version = 1, documentCode = applicant.documentCode): EligibilityRule {
  return {
    id: applicant.ruleId,
    version,
    routeCode: "FAMILY_VISIT",
    layer: applicant.applicantIndex > 1 ? "AGE_MINOR_OVERLAY" : "NATIONALITY_OVERLAY",
    classification: "OFFICIAL",
    sourceAuthority: "Synthetic Government Evidence Registry",
    reason: applicant.manualReason ?? "Synthetic authoritative family-route rule",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    conditions: [],
    eligibilityEffect: applicant.effect,
    requiredDocuments: [documentCode],
    conditionalDocuments: [],
  };
}

function snapshot(applicant: ApplicantFixture, options: { version?: number; documentCode?: string; supersedes?: string; reevaluationReason?: string; effect?: RuleEligibilityEffect } = {}): EvaluationEvidenceSnapshot {
  const evaluatedAt = new Date(options.version === 2 ? "2026-08-24T09:00:00.000Z" : "2026-08-24T08:00:00.000Z");
  const selectedRule = { ...rule(applicant, options.version ?? 1, options.documentCode), eligibilityEffect: options.effect ?? applicant.effect };
  const baseRoute: EligibilityRule = {
    id: "FAMILY-VISIT-BASE", version: 1, routeCode: "FAMILY_VISIT", layer: "BASE_ROUTE", classification: "OFFICIAL",
    sourceAuthority: "Synthetic Government Evidence Registry", reason: "Synthetic family visit route is available",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"), effectiveTo: null, conditions: [], eligibilityEffect: "ELIGIBLE",
    requiredDocuments: [], conditionalDocuments: [],
  };
  return createEvaluationEvidence({
    evaluationId: `local-eval-${applicant.applicantId}-v${options.version ?? 1}`,
    applicationId: LOCAL_ACCEPTANCE_APPLICATION_ID,
    applicantId: applicant.applicantId,
    selectedRoute: "FAMILY_VISIT",
    evaluatedAt,
    supersedesEvaluationId: options.supersedes ?? null,
    reevaluationReason: options.reevaluationReason ?? null,
    result: evaluateEligibility({ profile: { routeCode: "FAMILY_VISIT", attributes: {} }, rules: [baseRoute, selectedRule], evaluatedAt }),
  });
}

export type LocalAcceptanceState = "BLOCKED" | "REPLACEMENT_REQUIRED" | "RECOVERED" | "REEVALUATED" | "LEGACY";

export function buildLocalAcceptanceModel(state: LocalAcceptanceState): OperationsCaseReadModel {
  const legacy = state === "LEGACY";
  const resolved = state === "RECOVERED" || state === "REEVALUATED";
  const applicants = FAMILY.map((fixture) => {
    const childReviewResolved = resolved && fixture.applicantId === 91014;
    const fatherReevaluated = state === "REEVALUATED" && fixture.applicantId === 91011;
    const previous = snapshot(fixture);
    const current = fatherReevaluated
      ? snapshot(fixture, { version: 2, documentCode: "PASSPORT_AND_UPDATED_GCC_RESIDENCE", supersedes: previous.evaluationId, reevaluationReason: "Approved local Rule Version B" })
      : childReviewResolved
        ? snapshot(fixture, { version: 2, supersedes: previous.evaluationId, reevaluationReason: "Authorized human review completed", effect: "ELIGIBLE" })
        : previous;
    const replacement = state === "REPLACEMENT_REQUIRED" && fixture.applicantId === 91012;
    const childMissing = fixture.applicantId === 91013 && !resolved;
    const requirementState: RequirementInstanceState = replacement || childMissing ? "MISSING" : "VALIDATED";
    const documentReadiness = replacement ? "REJECTED" : childMissing ? "MISSING" : "VALIDATED";
    const code = fatherReevaluated ? "PASSPORT_AND_UPDATED_GCC_RESIDENCE" : fixture.documentCode;
    return {
      applicantId: fixture.applicantId,
      applicantIndex: fixture.applicantIndex,
      displayName: fixture.displayName,
      nationality: fixture.nationality,
      residenceCountry: fixture.residenceCountry,
      currentEvaluation: legacy ? null : current,
      previousEvaluations: legacy || current.evaluationId === previous.evaluationId ? [] : [previous],
      evaluationChange: legacy ? null : {
        previousEvaluationId: current.supersedesEvaluationId,
        currentEvaluationId: current.evaluationId,
        changedFields: current.supersedesEvaluationId ? ["eligibilityState", "matchedRuleVersions", "requiredDocuments"] : [],
        reason: current.reevaluationReason,
      },
      currentRuleVersions: legacy ? [] : current.matchedRuleVersions,
      dynamicRequirements: legacy ? [] : [{
        instance: { id: `local-requirement-${fixture.applicantId}-${current.evaluationId}`, applicationId: LOCAL_ACCEPTANCE_APPLICATION_ID, applicantId: fixture.applicantId, evaluationId: current.evaluationId, catalogVersion: "local-v1", code, kind: "DOCUMENT" as const, critical: true, conditional: false, createdAt: "2026-08-24T08:01:00.000Z" },
        currentState: requirementState,
      }],
      documents: [{ documentId: fixture.applicantId + 1000, applicantId: fixture.applicantId, code, readiness: documentReadiness as "MISSING" | "UPLOADED" | "VALIDATED" | "REJECTED" }],
      manualReviewRequired: legacy || (!childReviewResolved && fixture.effect === "HUMAN_REVIEW_REQUIRED"),
    };
  });

  const readiness = deriveFamilyReadiness(applicants.map((applicant) => ({
    applicantId: applicant.applicantId,
    evaluationId: applicant.currentEvaluation?.evaluationId ?? "",
    eligibilityState: applicant.currentEvaluation?.eligibilityState ?? "HUMAN_REVIEW_REQUIRED",
    routeCompatible: true,
    manualReviewReason: applicant.currentEvaluation?.manualReviewReason ?? (legacy ? "LEGACY_NOT_EVALUATED" : undefined),
    requirements: applicant.dynamicRequirements.map(({ instance, currentState }) => ({ applicantId: applicant.applicantId, code: instance.code, critical: instance.critical, state: currentState ?? "MISSING", customerAction: `Upload or replace ${instance.code} for ${applicant.displayName}` })),
  })));

  return {
    mode: legacy ? "LEGACY_NOT_EVALUATED" : "CURRENT",
    summary: { applicationId: LOCAL_ACCEPTANCE_APPLICATION_ID, reference: "TSH-LOCAL-FAMILY-91001", status: state === "RECOVERED" || state === "REEVALUATED" ? "under_review" : "documents_received", createdAt: "2026-08-24T08:00:00.000Z", assignedActorId: "staff:7001", teamId: 77, departmentId: 7, legacy },
    relationships: legacy ? FAMILY.map((item) => ({ applicantId: item.applicantId, relationship: item.applicantIndex === 0 ? "LEAD_APPLICANT" as const : "OTHER" as const })) : FAMILY.slice(1).map((item, index) => ({ id: `local-relationship-${index + 1}`, applicationId: LOCAL_ACCEPTANCE_APPLICATION_ID, fromApplicantId: 91011, toApplicantId: item.applicantId, relationship: item.applicantId === 91012 ? "SPOUSE" as const : "CHILD" as const, eventType: "ESTABLISHED" as const, reason: "Synthetic local acceptance family graph", occurredAt: `2026-08-24T08:00:0${index + 1}.000Z` })),
    applicants,
    familyReadiness: readiness,
    supplier: { id: 701, name: "XYZ Visa Services", slaHours: 24, reliabilityScore: 96 },
    operationalHistory: [
      { id: "local-event-created", event: "CASE_CREATED", actorType: "SYSTEM", occurredAt: "2026-08-24T08:00:00.000Z" },
      ...(state === "REPLACEMENT_REQUIRED" ? [{ id: "local-event-rejected", event: "DOCUMENT_NEEDS_REPLACEMENT", actorType: "STAFF", occurredAt: "2026-08-24T08:30:00.000Z" }] : []),
      ...(resolved ? [{ id: "local-event-replaced", event: "DOCUMENT_REPLACED_AND_ACCEPTED", actorType: "STAFF", occurredAt: "2026-08-24T08:45:00.000Z" }] : []),
      ...(state === "REEVALUATED" ? [{ id: "local-event-reevaluated", event: "REEVALUATION_REQUESTED", actorType: "STAFF", occurredAt: "2026-08-24T09:00:00.000Z" }] : []),
    ],
    legacyWarnings: legacy ? ["LEGACY_NOT_EVALUATED", "NO_HISTORICAL_RULE_EVIDENCE"] : [],
  };
}
