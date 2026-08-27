import { describe, expect, it } from "vitest";
import { createOperationalSubmissionPolicy, type OperationalSubmissionPolicy } from "./operational-submission-policy";
import type { SubmissionScheduleSnapshot, SubmissionTimingRule } from "./submission-scheduler";
import { recalculateForTravelDateChange } from "./travel-date-recalculation";

const official: SubmissionTimingRule = { ruleId: "official", version: 1, classification: "OFFICIAL", entryValidityDays: 60 };
const policy: OperationalSubmissionPolicy = { ...createOperationalSubmissionPolicy({ policyId: "policy", version: 1,
  effectiveFrom: "2026-01-01T00:00:00Z", sourceReference: "OWNER", thresholds: { scheduledAfterDays: 45,
    recommendedMinDays: 21, recommendedMaxDays: 45, readyMinDays: 8, readyMaxDays: 20, urgentMinDays: 4,
    urgentMaxDays: 7, humanReviewMinDays: 0, humanReviewMaxDays: 3, dueSoonDays: 14, alertUrgentDays: 7, dueTodayDays: 0 } }), state: "ACTIVE" };
const previous: SubmissionScheduleSnapshot = { evaluationId: "old", evaluatedAt: "2026-08-01T00:00:00Z", travelGroupId: "trip",
  routeCode: "GCC", plannedArrivalDate: "2026-10-01", earliestSafeSubmissionDate: "2026-08-17", targetSubmissionDate: "2026-09-17",
  latestSafeSubmissionDate: "2026-10-01", state: "SCHEDULED_FOR_SUBMISSION", reason: "FUTURE", blockingReasons: [],
  recalculationReason: "INITIAL_EVALUATION", ruleVersions: [], sourceEvidenceReferences: [], evidenceSha256: "a".repeat(64) };
const change = (overrides: Partial<Parameters<typeof recalculateForTravelDateChange>[0]> = {}) => recalculateForTravelDateChange({
  eventId: "event", newEvaluationId: "new", previous, expectedTravelGroupVersion: 2, currentTravelGroupVersion: 2,
  newArrivalDate: "2026-09-15", actorReference: "customer:application", reason: "Customer changed planned travel",
  occurredAt: new Date("2026-08-20T00:00:00Z"), alreadySubmitted: false, officialRule: official,
  operationalPolicy: policy, readinessSatisfied: true, ...overrides });

describe("travel-date recalculation contract", () => {
  it("creates a new immutable schedule and travel-change evidence before submission", () => {
    const result = change();
    expect(result.schedule).toMatchObject({ evaluationId: "new", plannedArrivalDate: "2026-09-15",
      recalculationReason: "TRAVEL_DATE_CHANGED_BEFORE_SUBMISSION", state: "RECOMMENDED_WINDOW" });
    expect(result.evidence).toMatchObject({ previousScheduleEvaluationId: "old", newScheduleEvaluationId: "new",
      previousTravelGroupVersion: 2, newTravelGroupVersion: 3, communicationEvents: ["TRAVEL_DATE_CHANGED"] });
    expect(previous.plannedArrivalDate).toBe("2026-10-01");
  });
  it("forces human review after government submission without rewriting history", () => {
    expect(change({ alreadySubmitted: true }).schedule).toMatchObject({ state: "HUMAN_REVIEW_REQUIRED",
      reason: "TRAVEL_DATE_CHANGED_AFTER_SUBMISSION", recalculationReason: "TRAVEL_DATE_CHANGED_AFTER_SUBMISSION" });
    expect(previous.state).toBe("SCHEDULED_FOR_SUBMISSION");
  });
  it("rejects stale, unchanged and unsupported date changes", () => {
    expect(() => change({ expectedTravelGroupVersion: 1 })).toThrow("TRAVEL_GROUP_VERSION_CONFLICT");
    expect(() => change({ newArrivalDate: previous.plannedArrivalDate })).toThrow("TRAVEL_DATE_UNCHANGED");
    expect(() => change({ newArrivalDate: "tomorrow" })).toThrow("INVALID_TRAVEL_DATE");
  });
});
