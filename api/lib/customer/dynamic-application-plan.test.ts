import { describe, expect, it } from "vitest";
import type { DynamicRequirementView } from "../requirements/dynamic-requirements";
import type { SubmissionScheduleSnapshot } from "../travel/submission-scheduler";
import { buildDynamicCustomerApplicationPlan } from "./dynamic-application-plan";

const requirements: DynamicRequirementView = {
  catalogVersion: "synthetic-v1",
  familyEligibilityState: "ELIGIBLE",
  applicants: [
    { applicantId: 1, evaluationId: "eval-father", documents: [{ code: "PASSPORT", label: "Passport", category: "IDENTITY", classification: "AUTHORITY_REQUIRED", state: "REQUIRED", reason: "Official rule" }], questions: [], warnings: [], manualReviewRequired: false },
    { applicantId: 2, evaluationId: "eval-child", documents: [{ code: "CONSENT", label: "Parental consent", category: "RELATIONSHIP", classification: "MAY_BE_REQUIRED", state: "CONDITIONAL", reason: "Minor rule" }], questions: [{ code: "TRAVELS_WITH_PARENT", prompt: "Travelling with a parent?", answerType: "BOOLEAN" }], warnings: [], manualReviewRequired: false },
  ],
};

const schedule: SubmissionScheduleSnapshot = {
  evaluationId: "schedule-1", evaluatedAt: "2026-08-25T00:00:00.000Z", travelGroupId: "trip-a", routeCode: "UAE_VISIT",
  plannedArrivalDate: "2026-12-20", earliestSafeSubmissionDate: "2026-11-20", targetSubmissionDate: "2026-12-01",
  latestSafeSubmissionDate: "2026-12-10", state: "SCHEDULED_FOR_SUBMISSION", reason: "SUBMISSION_WINDOW_NOT_OPEN",
  blockingReasons: [], recalculationReason: "INITIAL_EVALUATION", ruleVersions: [], sourceEvidenceReferences: [], evidenceSha256: "a".repeat(64),
};

describe("dynamic customer application plan", () => {
  it("keeps mixed-family questions and uploads scoped to their applicant", () => {
    const plan = buildDynamicCustomerApplicationPlan({
      applicationId: 7,
      identities: [
        { applicantId: 1, displayLabel: "Father", relationship: "LEAD_APPLICANT" },
        { applicantId: 2, displayLabel: "Child 1", relationship: "CHILD" },
      ],
      requirements,
      travelQuestions: [{ code: "ALL_APPLICANTS_TRAVELLING_TOGETHER", applicantId: null, reasonRuleIds: ["family-rule"] }],
      travelGroups: [{ travelGroupId: "trip-a", label: "Trip A", applicantIds: [1, 2], plannedArrivalDate: "2026-12-20", plannedDepartureDate: "2026-12-30" }],
      schedules: [schedule],
    });
    expect(plan.mode).toBe("FAMILY");
    expect(plan.applicants[0].uploads.map(({ code }) => code)).toEqual(["PASSPORT"]);
    expect(plan.applicants[1].uploads.map(({ code }) => code)).toEqual(["CONSENT"]);
    expect(plan.applicants[0].questions).toEqual([]);
    expect(plan.applicants[1].questions.map(({ code }) => code)).toEqual(["TRAVELS_WITH_PARENT"]);
    expect(plan.schedules[0]).toMatchObject({ submissionState: "SCHEDULED_FOR_SUBMISSION", plannedTravelDate: "2026-12-20" });
    expect(plan.canContinueToPayment).toBe(true);
  });

  it("rejects cross-applicant travel ownership", () => {
    expect(() => buildDynamicCustomerApplicationPlan({
      applicationId: 7,
      identities: [{ applicantId: 1, displayLabel: "Applicant", relationship: "LEAD_APPLICANT" }],
      requirements: { ...requirements, applicants: [requirements.applicants[0]] },
      travelQuestions: [], travelGroups: [{ travelGroupId: "trip", label: "Trip", applicantIds: [99], plannedArrivalDate: null, plannedDepartureDate: null }], schedules: [],
    })).toThrow("CUSTOMER_TRAVEL_GROUP_OWNERSHIP_INVALID");
  });

  it("blocks payment for unresolved applicant review without leaking another applicant", () => {
    const unresolved = { ...requirements, applicants: [requirements.applicants[0], { ...requirements.applicants[1], manualReviewRequired: true }] };
    const plan = buildDynamicCustomerApplicationPlan({
      applicationId: 7,
      identities: [{ applicantId: 1, displayLabel: "Father", relationship: "LEAD_APPLICANT" }, { applicantId: 2, displayLabel: "Child", relationship: "CHILD" }],
      requirements: unresolved, travelQuestions: [], travelGroups: [], schedules: [],
    });
    expect(plan.canContinueToPayment).toBe(false);
    expect(plan.blockingReasons).toEqual(["APPLICANT_REVIEW_REQUIRED:2"]);
  });
});
