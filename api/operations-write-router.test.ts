import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import { OperationsWriteError } from "./lib/operations/mysql-controlled-write-executor";
import { createOperationsWriteRouter, type OperationsWriteExecutor } from "./operations-write-router";

const context = (staffId?: number): TrpcContext => ({ req: new Request("https://internal.invalid/api/trpc"), resHeaders: new Headers(), isAdmin: false, staffId, customerApplicationReferences: new Set() });
const actor: AuthorizationActor = { id: "staff:7", permissions: new Set(["case.transition"]), scopes: ["TEAM"], teamIds: new Set([4]), departmentIds: new Set() };
const enabledFlag: FeatureFlagRecord = { flagKey: "OPERATIONS_CONTROLLED_WRITES", environment: "TEST", enabled: true, scopeType: "GLOBAL", scopeReference: "" };
const result = { status: "APPLIED" as const, applicationId: 41, version: 3, auditEventId: "audit-1" };

function dependencies(overrides: Partial<{ actorForContext: () => Promise<AuthorizationActor>; flagsForContext: () => Promise<readonly FeatureFlagRecord[]>; executor: OperationsWriteExecutor }> = {}) {
  const executor: OperationsWriteExecutor = {
    humanReview: vi.fn(async () => result), documentReview: vi.fn(async () => result), assignment: vi.fn(async () => result),
    statusTransition: vi.fn(async () => result), requestReevaluation: vi.fn(async () => result),
  };
  return { actorForContext: async () => actor, flagContextForContext: () => ({ environment: "TEST" as const }), flagsForContext: async () => [enabledFlag], executor, ...overrides };
}

describe("Operations controlled-write internal API gate", () => {
  it("fails closed before resolving an actor when the flag is disabled", async () => {
    const actorForContext = vi.fn(async () => actor);
    const deps = dependencies({ actorForContext, flagsForContext: async () => [] });
    const caller = createOperationsWriteRouter(deps).createCaller(context(7));
    await expect(caller.humanReview({ applicationId: 41, expectedVersion: 2, idempotencyKey: "review-001", reason: "Evidence reviewed", outcome: "APPROVED_FOR_NEXT_STEP" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(actorForContext).not.toHaveBeenCalled();
    expect(deps.executor.humanReview).not.toHaveBeenCalled();
  });

  it("requires a server-authenticated staff or admin context", async () => {
    const deps = dependencies();
    const caller = createOperationsWriteRouter(deps).createCaller(context());
    await expect(caller.assignment({ applicationId: 41, expectedVersion: 2, idempotencyKey: "assign-001", reason: "Queue assignment", mode: "ASSIGN", assigneeId: "staff:8" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deps.executor.assignment).not.toHaveBeenCalled();
  });

  it("rejects client-provided role, permission, and scope fields", async () => {
    const deps = dependencies();
    const caller = createOperationsWriteRouter(deps).createCaller(context(7));
    await expect(caller.humanReview({ applicationId: 41, expectedVersion: 2, idempotencyKey: "review-002", reason: "Evidence reviewed", outcome: "APPROVED_FOR_NEXT_STEP", role: "ADMIN", permissions: ["*"], teamId: 999 } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(deps.executor.humanReview).not.toHaveBeenCalled();
  });

  it("dispatches every enabled command with the server-derived actor", async () => {
    const deps = dependencies();
    const caller = createOperationsWriteRouter(deps).createCaller(context(7));
    await caller.humanReview({ applicationId: 41, expectedVersion: 2, idempotencyKey: "review-003", reason: "Evidence reviewed", outcome: "APPROVED_FOR_NEXT_STEP" });
    await caller.documentReview({ applicationId: 41, applicantId: 11, documentId: 19, expectedVersion: 2, expectedDocumentVersion: 1, idempotencyKey: "document-001", reason: "Image readable", outcome: "ACCEPTED" });
    await caller.assignment({ applicationId: 41, expectedVersion: 2, idempotencyKey: "assign-002", reason: "Queue assignment", mode: "ASSIGN", assigneeId: "staff:8" });
    await caller.statusTransition({ applicationId: 41, expectedVersion: 2, idempotencyKey: "status-001", reason: "Review started", to: "under_review" });
    await caller.requestReevaluation({ applicationId: 41, applicantId: 11, expectedCurrentEvaluationId: "evaluation-1", expectedVersion: 2, idempotencyKey: "reevaluate-001", reason: "Official rule changed" });
    for (const method of Object.values(deps.executor)) expect(method).toHaveBeenCalledWith(expect.any(Object), actor);
  });

  it("maps deterministic write conflicts without exposing persistence details", async () => {
    const deps = dependencies();
    deps.executor.humanReview = vi.fn(async () => { throw new OperationsWriteError("CONCURRENCY_CONFLICT"); });
    const caller = createOperationsWriteRouter(deps).createCaller(context(7));
    await expect(caller.humanReview({ applicationId: 41, expectedVersion: 2, idempotencyKey: "review-conflict-001", reason: "Evidence reviewed", outcome: "APPROVED_FOR_NEXT_STEP" }))
      .rejects.toMatchObject({ code: "CONFLICT", message: "CONCURRENCY_CONFLICT" });
  });

  it("sanitizes unexpected persistence failures", async () => {
    const deps = dependencies();
    deps.executor.humanReview = vi.fn(async () => { throw new OperationsWriteError("PERSISTENCE_FAILURE", new Error("synthetic raw database detail")); });
    const caller = createOperationsWriteRouter(deps).createCaller(context(7));
    await expect(caller.humanReview({ applicationId: 41, expectedVersion: 2, idempotencyKey: "review-failure-001", reason: "Evidence reviewed", outcome: "APPROVED_FOR_NEXT_STEP" }))
      .rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "PERSISTENCE_FAILURE" });
  });
});
