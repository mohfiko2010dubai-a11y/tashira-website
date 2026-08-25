import { describe, expect, it, vi } from "vitest";
import type { AuthorizationActor } from "../authorization/policy";
import type { SubmissionQueueItem } from "../operations/submission-queue";
import { SchedulerAlertService } from "./scheduler-alert-service";
import type { SchedulerAlertEvent } from "./scheduler-runtime";

const actor: AuthorizationActor = { id: "staff:7", permissions: new Set(["case.transition"]), scopes: ["TEAM"], teamIds: new Set([3]), departmentIds: new Set() };
const queue = (category: SubmissionQueueItem["category"]): SubmissionQueueItem => ({ applicationId: 1, applicationReference: "TSH-SYN",
  travelGroupId: "group-1", travelGroupReference: "Trip", scheduleEvaluationId: "schedule-1", applicantNames: [], routeCode: "VISA",
  plannedArrivalDate: "2026-09-20", targetSubmissionDate: "2026-09-01", latestSafeSubmissionDate: "2026-09-03",
  schedulerState: "SCHEDULED_FOR_SUBMISSION", readinessState: "READY", blockingReasons: [], manualReviewRequired: false,
  category, countdownDays: 3, teamId: 3 });

describe("scheduler alert internal reconciliation", () => {
  it("creates deterministic alerts only for actionable queue conditions", async () => {
    const create = vi.fn(async (input): Promise<SchedulerAlertEvent> => ({ ...input, id: "event", alertKey: "key", state: "CREATED", version: 1,
      actorId: actor.id, occurredAt: "2026-08-25T00:00:00.000Z" }));
    const service = new SchedulerAlertService({ create });
    await service.reconcile([queue("FUTURE"), queue("DUE_SOON")], actor);
    expect(create).toHaveBeenCalledTimes(1);
    const first = create.mock.calls[0][0];
    await service.reconcile([queue("DUE_SOON")], actor);
    expect(create.mock.calls[1][0].idempotencyKey).toBe(first.idempotencyKey);
    expect(create.mock.calls[1][0].correlationId).toBe(first.correlationId);
  });
});
