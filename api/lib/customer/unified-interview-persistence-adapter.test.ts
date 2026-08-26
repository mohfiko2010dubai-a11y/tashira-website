import { describe, expect, it } from "vitest";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";
import { ELIGIBILITY_ENGINE_VERSION } from "../eligibility/evaluation-evidence";
import { InMemoryFamilyPersistenceRepository } from "../family/family-persistence";
import type { MysqlOperationsCaseBundle } from "../operations/mysql-case-read-provider";
import { adaptPersistentUnifiedInterview } from "./unified-interview-persistence-adapter";

function fixture(): MysqlOperationsCaseBundle {
  const snapshots = new InMemoryEligibilitySnapshotRepository();
  for (const applicantId of [11, 12]) {
    snapshots.append({ evaluationId: `eval-${applicantId}`, applicationId: 7, applicantId, engineVersion: ELIGIBILITY_ENGINE_VERSION, selectedRoute: "TEST",
      evaluatedAt: "2026-08-26T00:00:00.000Z", eligibilityState: "ELIGIBLE", reason: "Synthetic", reevaluationReason: null,
      supersedesEvaluationId: null, manualReviewReason: null, matchedRuleIds: ["rule"], matchedRuleVersions: [{ ruleId: "rule", version: 1 }],
      sourceAuthorities: ["SYNTHETIC"], matchedRules: [], requiredDocuments: ["PASSPORT"], conditionalDocuments: [], warnings: [],
      precedenceTrace: [], evidenceSha256: "a".repeat(64), evidenceIntegrityReference: `sha256:${"a".repeat(64)}` });
    snapshots.select({ id: `select-${applicantId}`, applicationId: 7, applicantId, evaluationId: `eval-${applicantId}`,
      reason: "CURRENT", selectedBy: "system", selectedAt: "2026-08-26T00:01:00.000Z" });
  }
  const family = new InMemoryFamilyPersistenceRepository();
  family.appendRelationship({ id: "rel", applicationId: 7, fromApplicantId: 11, toApplicantId: 12, relationship: "CHILD",
    eventType: "ESTABLISHED", reason: "Customer", occurredAt: "2026-08-26T00:00:00.000Z" });
  return { snapshots, family, source: { summary: { applicationId: 7, reference: "TSH-TEST", status: "draft", createdAt: "2026-08-26", legacy: false },
    applicants: [{ applicantId: 11, applicantIndex: 0, displayName: "Mother", nationality: "EG", residenceCountry: null, routeCompatible: true },
      { applicantId: 12, applicantIndex: 1, displayName: "Child", nationality: "EG", residenceCountry: null, routeCompatible: true }],
    documents: [], supplier: null, operationalHistory: [], travelGroups: [{ id: "trip", reference: "Trip A", arrangement: "TOGETHER",
      primaryTravellerId: 11, accompanyingAdultId: 11, applicantIds: [11, 12], origin: "CAI", destination: "DXB", plannedArrivalDate: "2027-01-20",
      plannedDepartureDate: null, ticketStatus: "CONFIRMED", sharedDocuments: [{ documentId: 55, documentType: "FAMILY_BOOKING", applicantIds: [11, 12] }],
      currentSchedule: null, scheduleHistory: [] }] } };
}

describe("persistent Unified Interview adapter", () => {
  it("uses current immutable evaluations and preserves applicant/document ownership", () => {
    expect(adaptPersistentUnifiedInterview(fixture())).toMatchObject({ identities: [
      { applicantId: 11, relationship: "LEAD_APPLICANT" }, { applicantId: 12, relationship: "CHILD" }],
    family: { finalEligibilityState: "ELIGIBLE", members: [{ applicantId: 11 }, { applicantId: 12 }] },
    travelGroups: [{ id: "trip", applicantIds: [11, 12] }], sharedDocuments: [{ id: "55", linkedApplicantIds: [11, 12] }] });
  });

  it("fails closed instead of guessing a missing family relationship", () => {
    const bundle = fixture();
    expect(() => adaptPersistentUnifiedInterview({ ...bundle, family: new InMemoryFamilyPersistenceRepository() }))
      .toThrow("UNIFIED_INTERVIEW_RELATIONSHIP_MISSING:12");
  });

  it("fails closed when any applicant has no current immutable evaluation", () => {
    const bundle = fixture();
    const incomplete = new InMemoryEligibilitySnapshotRepository();
    const current = bundle.snapshots.current(7, 11);
    if (!current) throw new Error("fixture missing evaluation");
    incomplete.append(current);
    incomplete.select({ id: "only-lead", applicationId: 7, applicantId: 11, evaluationId: current.evaluationId,
      reason: "CURRENT", selectedBy: "system", selectedAt: "2026-08-26T00:02:00.000Z" });
    expect(() => adaptPersistentUnifiedInterview({ ...bundle, snapshots: incomplete }))
      .toThrow("UNIFIED_INTERVIEW_CURRENT_EVALUATION_MISSING:12");
  });
});
