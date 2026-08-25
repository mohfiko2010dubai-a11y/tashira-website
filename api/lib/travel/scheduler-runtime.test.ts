import { describe, expect, it } from "vitest";
import type { SubmissionScheduleSnapshot } from "./submission-scheduler";
import { appendSchedulerAlertEvent, schedulerCommunicationEvents, toSchedulerCustomerContract } from "./scheduler-runtime";

function snapshot(state: SubmissionScheduleSnapshot["state"], arrival = "2026-12-20"): SubmissionScheduleSnapshot {
  return { evaluationId: `schedule-${state}-${arrival}`, evaluatedAt: "2026-08-25T00:00:00.000Z", travelGroupId: "trip-a",
    routeCode: "GCC_RESIDENT", plannedArrivalDate: arrival, earliestSafeSubmissionDate: "2026-11-20",
    targetSubmissionDate: "2026-12-12", latestSafeSubmissionDate: "2026-12-15", state,
    reason: "SYNTHETIC", blockingReasons: [], recalculationReason: "SYNTHETIC_TEST",
    ruleVersions: [{ ruleId: "official-a", version: 1, classification: "OFFICIAL" },
      { ruleId: "policy-a", version: 2, classification: "OPERATIONAL" }],
    sourceEvidenceReferences: ["https://example.test/official"], evidenceSha256: "a".repeat(64) };
}

describe("scheduler runtime contracts", () => {
  it("creates, acknowledges and resolves append-only alerts with optimistic concurrency", () => {
    const base = { applicationId: 70, travelGroupId: "trip-a", scheduleEvaluationId: "schedule-a", type: "DUE_SOON" as const,
      severity: "WARNING" as const, category: "DUE_SOON" as const, correlationId: "corr-a", idempotencyKey: "idem-create" };
    const created = appendSchedulerAlertEvent({ history: [], ...base, eventId: "event-1", targetState: "CREATED", expectedVersion: 0,
      actorId: "system:scheduler", reason: "DUE_SOON_THRESHOLD_REACHED", occurredAt: "2026-08-25T00:00:00Z" });
    expect(created.event.version).toBe(1);
    expect(appendSchedulerAlertEvent({ history: [created.event], ...base, idempotencyKey: "idem-duplicate", eventId: "event-duplicate", targetState: "CREATED", expectedVersion: 1,
      actorId: "system:scheduler", reason: "RETRY", occurredAt: "2026-08-25T00:00:01Z" })).toEqual({ appended: false, event: created.event });
    const acknowledged = appendSchedulerAlertEvent({ history: [created.event], ...base, idempotencyKey: "idem-ack", eventId: "event-2", targetState: "ACKNOWLEDGED", expectedVersion: 1,
      actorId: "staff:31", reason: "CASE_REVIEW_STARTED", occurredAt: "2026-08-25T01:00:00Z" });
    expect(acknowledged.event.version).toBe(2);
    const resolved = appendSchedulerAlertEvent({ history: [created.event, acknowledged.event], ...base, idempotencyKey: "idem-resolve", eventId: "event-3", targetState: "RESOLVED", expectedVersion: 2,
      actorId: "staff:31", reason: "REQUIREMENTS_COMPLETE", occurredAt: "2026-08-25T02:00:00Z" });
    expect(resolved.event.state).toBe("RESOLVED");
    expect(() => appendSchedulerAlertEvent({ history: [created.event], ...base, idempotencyKey: "idem-stale", eventId: "stale", targetState: "RESOLVED", expectedVersion: 0,
      actorId: "staff:31", reason: "STALE", occurredAt: "2026-08-25T02:00:00Z" })).toThrow("SCHEDULER_ALERT_VERSION_CONFLICT");
  });

  it("returns customer-safe scheduled and too-early contracts without policy math", () => {
    const scheduled = toSchedulerCustomerContract(snapshot("SCHEDULED_FOR_SUBMISSION"));
    expect(scheduled.state).toBe("SCHEDULED_FOR_SUBMISSION");
    expect(scheduled.ruleClassification).toBe("MIXED");
    expect(JSON.stringify(scheduled)).not.toMatch(/preferredLeadDays|safetyBufferDays|expectedProcessingDays/);
    expect(toSchedulerCustomerContract(snapshot("TOO_EARLY")).state).toBe("APPLICATION_TOO_EARLY");
  });

  it("derives canonical communication events only on meaningful transitions", () => {
    expect(schedulerCommunicationEvents({ previous: null, current: snapshot("SCHEDULED_FOR_SUBMISSION") }))
      .toEqual(["APPLICATION_SCHEDULED_FOR_SUBMISSION"]);
    expect(schedulerCommunicationEvents({ previous: snapshot("SCHEDULED_FOR_SUBMISSION"), current: snapshot("READY_FOR_SUBMISSION", "2027-01-20") }))
      .toEqual(["TRAVEL_DATE_CHANGED", "APPLICATION_READY_FOR_SUBMISSION"]);
    expect(schedulerCommunicationEvents({ previous: snapshot("READY_FOR_SUBMISSION"), current: snapshot("ALREADY_SUBMITTED") }))
      .toEqual(["SUBMISSION_COMPLETED"]);
  });
});
