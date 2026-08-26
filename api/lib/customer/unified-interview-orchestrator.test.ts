import { describe, expect, it } from "vitest";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { FamilyEvaluation } from "../family/family-engine";
import type { MysqlRequirementCatalogProvider } from "../requirements/mysql-requirement-catalog-provider";
import type { VersionedRequirementCatalog } from "../requirements/requirement-catalog";
import type { SubmissionScheduleSnapshot } from "../travel/submission-scheduler";
import { buildUnifiedInterviewRuntime } from "./unified-interview-orchestrator";

const at = new Date("2026-08-26T00:00:00Z");
const flags: FeatureFlagRecord[] = ["VISA_RULES_EVALUATION", "DYNAMIC_REQUIREMENTS", "DYNAMIC_CUSTOMER_APPLICATION"].map((flagKey) => ({
  flagKey: flagKey as FeatureFlagRecord["flagKey"], environment: "STAGING", enabled: true, scopeType: "APPLICATION", scopeReference: "TSH-TEST",
}));
const catalog: VersionedRequirementCatalog = { catalogVersion: "test-v1", requirements: [{ kind: "DOCUMENT", definitionId: "11111111-1111-4111-8111-111111111111",
  code: "PASSPORT", version: 1, status: "ACTIVE", customerLabel: "Passport copy", shortCustomerExplanation: "Passport bio page", internalLabel: "Passport",
  classification: "OFFICIAL", authoritySemantics: null, reasonTemplate: "Required by authority", effectiveFrom: at, effectiveTo: null, reviewStatus: "APPROVED",
  documentType: "PASSPORT", category: "IDENTITY", requiredCapability: true, conditionalCapability: false, sharedDocumentCapability: false,
  applicantScopedCapability: true, travelGroupScopedCapability: false, familyScopedCapability: false, aiExtractionCapability: false, humanReviewPolicy: "ALWAYS" }], questions: [] };
const catalogProvider = { active: async () => catalog } satisfies Pick<MysqlRequirementCatalogProvider, "active">;
const family: FamilyEvaluation = { applicationId: 7, finalEligibilityState: "ELIGIBLE", manualReviewReasons: [], members: [1, 2].map((applicantId) => ({ applicantId,
  evaluationId: `eval-${applicantId}`, ruleVersions: [{ ruleId: "rule", version: 1 }], eligibilityState: "ELIGIBLE" as const,
  requiredDocuments: [{ applicantId, code: "PASSPORT", evaluationId: `eval-${applicantId}` }], conditionalDocuments: [], warnings: [] })) };
const schedule: SubmissionScheduleSnapshot = { evaluationId: "schedule", evaluatedAt: at.toISOString(), travelGroupId: "trip-b", routeCode: "TEST",
  plannedArrivalDate: "2027-01-20", earliestSafeSubmissionDate: "2026-12-20", targetSubmissionDate: "2027-01-01", latestSafeSubmissionDate: "2027-01-10",
  state: "SCHEDULED_FOR_SUBMISSION", reason: "SUBMISSION_WINDOW_NOT_OPEN", blockingReasons: [], recalculationReason: "INITIAL_EVALUATION", ruleVersions: [],
  sourceEvidenceReferences: [], evidenceSha256: "a".repeat(64) };

describe("unified Dynamic Interview orchestration", () => {
  it("projects one canonical family/travel/requirements/scheduler model and identical portal handoff", async () => {
    const result = await buildUnifiedInterviewRuntime({ context: { environment: "STAGING", applicationReference: "TSH-TEST" }, flags,
      catalogProvider, evaluatedAt: at, applicationId: 7,
      identities: [{ applicantId: 1, displayLabel: "Mother", relationship: "LEAD_APPLICANT" }, { applicantId: 2, displayLabel: "Child", relationship: "CHILD" }],
      family, answers: {}, travelQuestions: [], travelGroups: [{ id: "trip-b", applicationId: 7, applicantIds: [1, 2], primaryTravellerId: 1,
        accompanyingAdultId: 1, arrangement: "SEPARATELY", origin: "DXB", destination: "CAI", plannedArrivalDate: "2027-01-20", plannedDepartureDate: "2027-02-01", ticketStatus: "CONFIRMED" }],
      schedules: [schedule], sharedDocuments: [{ id: "booking", applicationId: 7, type: "FAMILY_BOOKING", linkedApplicantIds: [1] }] });
    expect(result.review).toMatchObject({ applicants: [{ applicantId: 1, requirements: [{ label: "Passport copy" }] }, { applicantId: 2 }],
      travelGroups: [{ travelGroupId: "trip-b", applicantIds: [1, 2] }], schedules: [{ state: "SCHEDULED_FOR_SUBMISSION" }],
      sharedDocuments: [{ linkedApplicantIds: [1], missingApplicantIds: [2] }] });
    expect(result.portalHandoff).toEqual(result.review);
  });

  it("fails closed for cross-application shared-document ownership", async () => {
    await expect(buildUnifiedInterviewRuntime({ context: { environment: "STAGING", applicationReference: "TSH-TEST" }, flags,
      catalogProvider, evaluatedAt: at, applicationId: 7,
      identities: [{ applicantId: 1, displayLabel: "Applicant", relationship: "LEAD_APPLICANT" }],
      family: { ...family, members: [family.members[0]] }, answers: {}, travelQuestions: [], travelGroups: [], schedules: [],
      sharedDocuments: [{ id: "wrong", applicationId: 99, type: "FAMILY_BOOKING", linkedApplicantIds: [1] }] }))
      .rejects.toThrow("UNIFIED_INTERVIEW_DOCUMENT_OWNERSHIP_INVALID");
  });

  it("fails closed when a current schedule does not belong to a current travel group", async () => {
    await expect(buildUnifiedInterviewRuntime({ context: { environment: "STAGING", applicationReference: "TSH-TEST" }, flags,
      catalogProvider, evaluatedAt: at, applicationId: 7,
      identities: [{ applicantId: 1, displayLabel: "Applicant", relationship: "LEAD_APPLICANT" }],
      family: { ...family, members: [family.members[0]] }, answers: {}, travelQuestions: [], travelGroups: [], schedules: [schedule], sharedDocuments: [] }))
      .rejects.toThrow("UNIFIED_INTERVIEW_SCHEDULE_OWNERSHIP_INVALID");
  });

  it("returns no customer runtime while required scoped flags are closed", async () => {
    const result = await buildUnifiedInterviewRuntime({ context: { environment: "STAGING", applicationReference: "TSH-TEST" }, flags: [],
      catalogProvider, evaluatedAt: at, applicationId: 7,
      identities: [{ applicantId: 1, displayLabel: "Applicant", relationship: "LEAD_APPLICANT" }], family: { ...family, members: [family.members[0]] },
      answers: {}, travelQuestions: [], travelGroups: [], schedules: [], sharedDocuments: [] });
    expect(result).toEqual({ review: null, portalHandoff: null });
  });
});
