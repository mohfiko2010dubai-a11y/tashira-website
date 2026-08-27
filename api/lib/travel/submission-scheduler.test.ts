import { describe, expect, it } from "vitest";
import { createOperationalSubmissionPolicy, type OperationalSubmissionPolicy } from "./operational-submission-policy";
import { evaluateSubmissionSchedule, type SubmissionTimingRule } from "./submission-scheduler";

const official: SubmissionTimingRule = { ruleId: "official-entry", version: 2, classification: "OFFICIAL", entryValidityDays: 60 };
const operational: OperationalSubmissionPolicy = { ...createOperationalSubmissionPolicy({ policyId: "ops-window", version: 1,
  effectiveFrom: "2026-01-01T00:00:00.000Z", sourceReference: "OWNER_APPROVED_V1_POLICY",
  thresholds: { scheduledAfterDays: 45, recommendedMinDays: 21, recommendedMaxDays: 45,
    readyMinDays: 8, readyMaxDays: 20, urgentMinDays: 4, urgentMaxDays: 7,
    humanReviewMinDays: 0, humanReviewMaxDays: 3, dueSoonDays: 14, alertUrgentDays: 7, dueTodayDays: 0 } }), state: "ACTIVE" };
const evaluate = (daysUntilArrival: number, overrides: Partial<Parameters<typeof evaluateSubmissionSchedule>[0]> = {}) => {
  const evaluatedAt = new Date("2026-10-01T00:00:00.000Z");
  const arrival = new Date(evaluatedAt); arrival.setUTCDate(arrival.getUTCDate() + daysUntilArrival);
  return evaluateSubmissionSchedule({ evaluationId: "schedule-1", evaluatedAt, travelGroupId: "trip-a",
    routeCode: "VISIT_30_SINGLE", plannedArrivalDate: arrival.toISOString().slice(0, 10), officialRule: official,
    operationalPolicy: operational, readinessSatisfied: true, ...overrides });
};

describe("owner-approved deterministic submission scheduler", () => {
  it.each([[46, "SCHEDULED_FOR_SUBMISSION"], [45, "RECOMMENDED_WINDOW"], [21, "RECOMMENDED_WINDOW"],
    [20, "READY_FOR_SUBMISSION"], [8, "READY_FOR_SUBMISSION"], [7, "URGENT"], [4, "URGENT"],
    [3, "HUMAN_REVIEW_REQUIRED"], [0, "HUMAN_REVIEW_REQUIRED"], [-1, "OVERDUE"]] as const)(
    "maps %i days to %s without boundary gaps", (days, state) => expect(evaluate(days).state).toBe(state));

  it("never becomes ready while readiness is blocked", () => {
    expect(evaluate(15, { readinessSatisfied: false, blockingReasons: ["APPLICANT_2_MISSING_PASSPORT"] }).state)
      .toBe("BLOCKED_BY_REQUIREMENTS");
    expect(evaluate(6, { manualReviewRequired: true, blockingReasons: ["RULE_CONFLICT"] }).state)
      .toBe("BLOCKED_BY_MANUAL_REVIEW");
  });

  it("fails closed when official or active operational evidence is unresolved", () => {
    expect(evaluate(15, { officialRule: null }).state).toBe("HUMAN_REVIEW_REQUIRED");
    expect(evaluate(15, { operationalPolicy: null }).state).toBe("HUMAN_REVIEW_REQUIRED");
    expect(evaluate(15, { operationalPolicy: { ...operational, state: "APPROVED" } }).state).toBe("HUMAN_REVIEW_REQUIRED");
  });

  it("preserves immutable evidence and exact official/operational versions", () => {
    expect(evaluate(15).ruleVersions).toEqual([
      { ruleId: "official-entry", version: 2, classification: "OFFICIAL" },
      { ruleId: "ops-window", version: 1, classification: "OPERATIONAL" },
    ]);
    expect(evaluate(15).evidenceSha256).toBe(evaluate(15).evidenceSha256);
    expect(evaluate(14).evidenceSha256).not.toBe(evaluate(15).evidenceSha256);
  });
});
