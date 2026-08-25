import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import { SchedulerAlertPersistenceError } from "./lib/travel/mysql-scheduler-alert-provider";
import type { SchedulerAlertEvent } from "./lib/travel/scheduler-runtime";
import { createOperationsAlertRouter, type SchedulerAlertService } from "./operations-alert-router";

const context = (staffId?: number): TrpcContext => ({ req: new Request("https://internal.invalid/api/trpc"), resHeaders: new Headers(),
  isAdmin: staffId === undefined, staffId, customerApplicationReferences: new Set() });
const actor: AuthorizationActor = { id: "staff:7", permissions: new Set(["case.read", "case.transition"]),
  scopes: ["TEAM"], teamIds: new Set([4]), departmentIds: new Set() };
const alertId = "11111111-1111-4111-8111-111111111111";
const event: SchedulerAlertEvent = { id: alertId, alertKey: "1:group:schedule:DUE_SOON", applicationId: 41, applicantId: null,
  travelGroupId: "group", scheduleEvaluationId: "schedule", type: "DUE_SOON", severity: "WARNING", category: "DUE_SOON",
  state: "CREATED", version: 1, actorId: actor.id, reason: "Submission window approaching", context: { countdownDays: 7 },
  correlationId: "correlation-1", idempotencyKey: "scheduler-create-1", occurredAt: "2026-08-25T00:00:00.000Z" };

function service(): SchedulerAlertService {
  return { listForApplication: vi.fn(async () => [event]), get: vi.fn(async () => event),
    acknowledge: vi.fn(async (): Promise<SchedulerAlertEvent> => ({ ...event, state: "ACKNOWLEDGED", version: 2 })),
    resolve: vi.fn(async (): Promise<SchedulerAlertEvent> => ({ ...event, state: "RESOLVED", version: 2 })) };
}

describe("Operations scheduler alert API", () => {
  it("requires an authenticated scoped staff identity", async () => {
    const current = service();
    const caller = createOperationsAlertRouter({ actorForContext: async () => actor, service: current }).createCaller(context());
    await expect(caller.list({ applicationId: 41 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(current.listForApplication).not.toHaveBeenCalled();
  });

  it("lists and reads alerts through the trusted server actor", async () => {
    const current = service();
    const caller = createOperationsAlertRouter({ actorForContext: async () => actor, service: current }).createCaller(context(7));
    expect(await caller.list({ applicationId: 41 })).toEqual([event]);
    expect(await caller.get({ applicationId: 41, alertId })).toEqual(event);
    expect(current.listForApplication).toHaveBeenCalledWith(41, actor);
    expect(current.get).toHaveBeenCalledWith(41, alertId, actor);
  });

  it("accepts only identifiers, concurrency, idempotency and evidence for transitions", async () => {
    const current = service();
    const caller = createOperationsAlertRouter({ actorForContext: async () => actor, service: current }).createCaller(context(7));
    const command = { applicationId: 41, alertId, expectedVersion: 1, idempotencyKey: "acknowledge-1", correlationId: "correlation-1", reason: "Employee accepted responsibility" };
    await caller.acknowledge(command);
    expect(current.acknowledge).toHaveBeenCalledWith(command, actor);
    await expect(caller.resolve({ ...command, type: "OVERDUE", severity: "CRITICAL" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("maps conflicts and sanitizes unexpected failures", async () => {
    const current = service();
    current.acknowledge = vi.fn(async () => { throw new SchedulerAlertPersistenceError("CONCURRENCY_CONFLICT"); });
    current.resolve = vi.fn(async () => { throw new Error("raw database detail"); });
    const caller = createOperationsAlertRouter({ actorForContext: async () => actor, service: current }).createCaller(context(7));
    const command = { applicationId: 41, alertId, expectedVersion: 1, idempotencyKey: "acknowledge-1", correlationId: "correlation-1", reason: "Employee accepted responsibility" };
    await expect(caller.acknowledge(command)).rejects.toMatchObject({ code: "CONFLICT", message: "CONCURRENCY_CONFLICT" });
    await expect(caller.resolve(command)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Scheduler alert unavailable" });
  });
});
