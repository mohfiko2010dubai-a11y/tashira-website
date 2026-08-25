import { describe, expect, it } from "vitest";
import { evaluateSubmissionSchedule, type SubmissionTimingRule } from "./submission-scheduler";

const official: SubmissionTimingRule = { ruleId: "official-entry", version: 2, classification: "OFFICIAL", entryValidityDays: 60, expectedProcessingDays: 0, safetyBufferDays: 0, preferredLeadDays: 0 };
const operational: SubmissionTimingRule = { ruleId: "ops-window", version: 4, classification: "OPERATIONAL", entryValidityDays: null, expectedProcessingDays: 5, safetyBufferDays: 3, preferredLeadDays: 30 };
const evaluate = (overrides: Partial<Parameters<typeof evaluateSubmissionSchedule>[0]> = {}) => evaluateSubmissionSchedule({
  evaluationId: "schedule-1", evaluatedAt: new Date("2026-10-01T00:00:00.000Z"), travelGroupId: "trip-a",
  routeCode: "VISIT_30_SINGLE", plannedArrivalDate: "2026-12-01", officialRule: official,
  operationalRule: operational, readinessSatisfied: true, ...overrides,
});

describe("deterministic submission scheduler", () => {
  it("schedules an early complete application without calling policy official", () => {
    const result = evaluate();
    expect(result.state).toBe("SCHEDULED_FOR_SUBMISSION");
    expect(result.earliestSafeSubmissionDate).toBe("2026-11-01");
    expect(result.ruleVersions).toEqual(expect.arrayContaining([
      expect.objectContaining({ classification: "OFFICIAL" }), expect.objectContaining({ classification: "OPERATIONAL" }),
    ]));
  });

  it("becomes ready only when the window and prerequisites are satisfied", () => {
    expect(evaluate({ evaluatedAt: new Date("2026-11-25T00:00:00.000Z") }).state).toBe("READY_FOR_SUBMISSION");
    expect(evaluate({ evaluatedAt: new Date("2026-11-25T00:00:00.000Z"), readinessSatisfied: false,
      blockingReasons: ["APPLICANT_2_MISSING_PASSPORT"] }).state).toBe("BLOCKED");
  });

  it("fails to human review when official or operational timing evidence is absent", () => {
    expect(evaluate({ officialRule: null }).state).toBe("HUMAN_REVIEW_REQUIRED");
    expect(evaluate({ operationalRule: null }).state).toBe("HUMAN_REVIEW_REQUIRED");
  });

  it("produces deterministic immutable evidence", () => {
    expect(evaluate().evidenceSha256).toBe(evaluate().evidenceSha256);
    expect(evaluate({ plannedArrivalDate: "2026-12-02" }).evidenceSha256).not.toBe(evaluate().evidenceSha256);
  });
});
