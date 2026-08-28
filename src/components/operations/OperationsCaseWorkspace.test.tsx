import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEvaluationEvidence } from "../../../api/lib/eligibility/evaluation-evidence";
import { evaluateEligibility, type EligibilityRule } from "../../../api/lib/eligibility/eligibility-engine";
import type { OperationsCaseReadModel } from "../../../api/lib/operations/case-read-model";
import OperationsCaseWorkspace from "./OperationsCaseWorkspace";

function snapshot(applicantId: number, ruleId: string, version: number, document: string) {
  const rule: EligibilityRule = {
    id: ruleId, version, routeCode: "FAMILY", layer: "BASE_ROUTE", classification: "OFFICIAL",
    sourceAuthority: `${ruleId} Authority`, reason: "Synthetic", effectiveFrom: new Date("2026-01-01"), effectiveTo: null,
    conditions: [], eligibilityEffect: "ELIGIBLE", requiredDocuments: [document], conditionalDocuments: [],
  };
  return createEvaluationEvidence({
    evaluationId: `eval-${applicantId}`, applicationId: 1, applicantId, selectedRoute: "FAMILY", evaluatedAt: new Date("2026-06-01"),
    result: evaluateEligibility({ profile: { routeCode: "FAMILY", attributes: {} }, rules: [rule], evaluatedAt: new Date("2026-06-01") }),
  });
}

function model(legacy = false): OperationsCaseReadModel {
  const father = snapshot(11, "EGYPT-UAE", 2, "FATHER_PASSPORT");
  const mother = snapshot(12, "INDIA-QATAR", 7, "MOTHER_PASSPORT");
  return {
    mode: legacy ? "LEGACY_NOT_EVALUATED" : "CURRENT",
    summary: { applicationId: 1, reference: "TSH-SYNTHETIC", status: "REVIEW", createdAt: "2026-06-01", assignedActorId: "staff:7", teamId: 3, departmentId: 2, legacy },
    relationships: legacy ? [{ applicantId: 11, relationship: "LEAD_APPLICANT" }, { applicantId: 12, relationship: "OTHER" }] : [],
    applicants: [
      {
        applicantId: 11, applicantIndex: 0, displayName: "Father", nationality: "Egypt", residenceCountry: "UAE",
        currentEvaluation: legacy ? null : father, previousEvaluations: [], evaluationChange: legacy ? null : { previousEvaluationId: null, currentEvaluationId: father.evaluationId, changedFields: [], reason: null },
        currentRuleVersions: legacy ? [] : father.matchedRuleVersions,
        dynamicRequirements: legacy ? [] : [{ instance: { id: "req-f", applicationId: 1, applicantId: 11, evaluationId: father.evaluationId, catalogVersion: "v2", code: "FATHER_PASSPORT", kind: "DOCUMENT", critical: true, conditional: false, createdAt: "2026-06-01" }, currentState: "VALIDATED" }],
        documents: [{ documentId: 101, applicantId: 11, code: "FATHER_PASSPORT", readiness: "VALIDATED" }], manualReviewRequired: legacy,
      },
      {
        applicantId: 12, applicantIndex: 1, displayName: "Mother", nationality: "India", residenceCountry: "Qatar",
        currentEvaluation: legacy ? null : mother, previousEvaluations: [], evaluationChange: legacy ? null : { previousEvaluationId: null, currentEvaluationId: mother.evaluationId, changedFields: [], reason: null },
        currentRuleVersions: legacy ? [] : mother.matchedRuleVersions,
        dynamicRequirements: legacy ? [] : [{ instance: { id: "req-m", applicationId: 1, applicantId: 12, evaluationId: mother.evaluationId, catalogVersion: "v7", code: "MOTHER_PASSPORT", kind: "DOCUMENT", critical: true, conditional: false, createdAt: "2026-06-01" }, currentState: "MISSING" }],
        documents: [{ documentId: 102, applicantId: 12, code: "MOTHER_PASSPORT", readiness: "MISSING" }], manualReviewRequired: legacy,
      },
    ],
    familyReadiness: {
      family_readiness_state: "NOT_READY", blocking_applicant_ids: [12],
      blocking_reasons: [{ applicant_id: 12, code: "CRITICAL_DOCUMENT_MISSING", reason: "MOTHER_PASSPORT is not complete" }],
      member_states: [{ applicant_id: 11, evaluation_id: legacy ? "" : father.evaluationId, readiness_state: legacy ? "MANUAL_REVIEW_REQUIRED" : "READY" }, { applicant_id: 12, evaluation_id: legacy ? "" : mother.evaluationId, readiness_state: legacy ? "MANUAL_REVIEW_REQUIRED" : "WAITING_FOR_DOCUMENTS" }],
      required_customer_actions: [{ applicant_id: 12, action: "Complete MOTHER_PASSPORT" }], manual_review_required: legacy, route_compatibility_warnings: [],
    },
    supplier: { id: 5, name: "Synthetic Supplier", slaHours: 24, reliabilityScore: 95 },
    operationalHistory: [{ id: "event-1", event: "OPERATIONS_DOCUMENT_REVIEW", actorType: "STAFF", actorReference: "staff:7", reason: "Manual review requested", occurredAt: "2026-06-01" }],
    travelGroups: legacy ? [] : [{ id: "trip-a", version: 1, reference: "Travel Group A", arrangement: "TOGETHER", primaryTravellerId: 11,
      accompanyingAdultId: 11, applicantIds: [11, 12], origin: "CAI", destination: "DXB", plannedArrivalDate: "2026-12-20",
      plannedDepartureDate: "2026-12-30", ticketStatus: "CONFIRMED", sharedDocuments: [{ documentId: 101, applicantIds: [11, 12], documentType: "FAMILY_BOOKING" }],
      currentSchedule: { evaluationId: "schedule-a", evaluatedAt: "2026-08-25", travelGroupId: "trip-a", routeCode: "FAMILY",
        plannedArrivalDate: "2026-12-20", earliestSafeSubmissionDate: "2026-11-20", targetSubmissionDate: "2026-12-12",
        latestSafeSubmissionDate: "2026-12-15", state: "SCHEDULED_FOR_SUBMISSION", reason: "SUBMISSION_WINDOW_NOT_OPEN",
        blockingReasons: [], recalculationReason: "INITIAL_EVALUATION", ruleVersions: [], sourceEvidenceReferences: [], evidenceSha256: "a".repeat(64) },
      scheduleHistory: [] }],
    legacyWarnings: legacy ? ["LEGACY_RELATIONSHIP_GRAPH_INFERRED"] : [],
  };
}

describe("Operations Case Workspace", () => {
  it("renders nothing while the feature flag is closed", () => {
    expect(renderToStaticMarkup(<OperationsCaseWorkspace enabled={false} model={model()} />)).toBe("");
  });

  it("renders the approved read-only section order", () => {
    const html = renderToStaticMarkup(<OperationsCaseWorkspace enabled model={model()} />);
    const headings = ["Case Overview", "Applicants", "Requirements", "Travel Party", "Submission Schedule", "Documents", "Evaluation History", "Family Readiness", "Timeline", "Supplier"];
    for (let index = 1; index < headings.length; index += 1) {
      expect(html.indexOf(headings[index - 1])).toBeLessThan(html.indexOf(headings[index]));
    }
    expect(html).not.toContain("<button");
  });

  it("renders travel party and scheduler evidence without financial fields", () => {
    const html = renderToStaticMarkup(<OperationsCaseWorkspace enabled model={model()} />);
    expect(html).toContain("Travel Group A");
    expect(html).toContain("SCHEDULED_FOR_SUBMISSION");
    expect(html).toContain("2026-12-12");
    expect(html).toContain("Shared booking links: 1");
  });

  it("keeps applicant requirements and documents visibly isolated", () => {
    const html = renderToStaticMarkup(<OperationsCaseWorkspace enabled model={model()} />);
    expect(html).toContain("Father");
    expect(html).toContain("FATHER_PASSPORT");
    expect(html).toContain("Mother");
    expect(html).toContain("MOTHER_PASSPORT");
    expect(html).toContain("EGYPT-UAE v2");
    expect(html).toContain("INDIA-QATAR v7");
  });

  it("renders controlled action audit details in the visible timeline", () => {
    const html = renderToStaticMarkup(<OperationsCaseWorkspace enabled model={model()} />);
    expect(html).toContain("OPERATIONS_DOCUMENT_REVIEW");
    expect(html).toContain("staff:7");
    expect(html).toContain("Manual review requested");
  });

  it("never renders supplier financial fields", () => {
    const financial = { ...model(), supplier: { id: 5, name: "Synthetic Supplier", slaHours: 24, reliabilityScore: 95, effectiveCost: "987654.32", internalCost: "876543.21" } };
    const html = renderToStaticMarkup(<OperationsCaseWorkspace enabled model={financial} />);
    expect(html).not.toContain("effectiveCost");
    expect(html).not.toContain("internalCost");
    expect(html).not.toContain("Margin");
    expect(html).not.toContain("987654.32");
    expect(html).not.toContain("876543.21");
  });

  it("clearly marks legacy records without inventing evaluation history", () => {
    const html = renderToStaticMarkup(<OperationsCaseWorkspace enabled model={model(true)} />);
    expect(html).toContain("LEGACY_NOT_EVALUATED");
    expect(html).toContain("NOT_EVALUATED");
    expect(html).not.toContain("EGYPT-UAE v2");
  });
});
