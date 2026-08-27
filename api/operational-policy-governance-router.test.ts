import { describe, expect, it, vi } from "vitest";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { TrpcContext } from "./context";
import { createOperationalPolicyGovernanceRouter } from "./operational-policy-governance-router";

const actor: AuthorizationActor = { id: "staff:7", permissions: new Set(["rule.read", "rule.propose", "rule.review", "rule.activate"]),
  scopes: ["ALL"], teamIds: new Set(), departmentIds: new Set() };
const context = (): TrpcContext => ({ req: new Request("https://internal.invalid/api/trpc"), resHeaders: new Headers(),
  isAdmin: false, staffId: 7, customerApplicationReferences: new Set() });
const policyThresholds = { scheduledAfterDays: 45, recommendedMinDays: 21, recommendedMaxDays: 45,
  readyMinDays: 8, readyMaxDays: 20, urgentMinDays: 4, urgentMaxDays: 7, humanReviewMinDays: 0,
  humanReviewMaxDays: 3, dueSoonDays: 14, alertUrgentDays: 7, dueTodayDays: 0 as const };

describe("operational policy governance router", () => {
  it("exposes strict read/propose/transition contracts with server actor and time", async () => {
    const repository = { list: vi.fn(async () => []), history: vi.fn(async () => []),
      propose: vi.fn(async () => ({ policyId: "46df7d3d-4ac6-46da-886e-d85cc8507dad" as const, state: "DRAFT" as const, recordVersion: 1, evidenceSha256: "a".repeat(64) })),
      transition: vi.fn(async () => ({ policyId: "46df7d3d-4ac6-46da-886e-d85cc8507dad", state: "REVIEW" as const, recordVersion: 2 })) };
    const now = new Date("2026-08-27T12:00:00Z");
    const caller = createOperationalPolicyGovernanceRouter({ actorForContext: async () => actor, repository, now: () => now }).createCaller(context());
    await expect(caller.capabilities({})).resolves.toEqual({ read: true, propose: true, review: true, activate: true });
    await caller.propose({ version: 2, thresholds: policyThresholds, effectiveFrom: now, effectiveTo: null,
      sourceReference: "OWNER_APPROVED_POLICY", reason: "New governed version" });
    expect(repository.propose).toHaveBeenCalledWith(expect.objectContaining({ thresholds: policyThresholds }), actor, now);
    await caller.transition({ policyId: "46df7d3d-4ac6-46da-886e-d85cc8507dad", expectedVersion: 1, toState: "REVIEW", reason: "Review" });
    expect(repository.transition).toHaveBeenCalledWith(expect.objectContaining({ toState: "REVIEW" }), actor, now);
  });

  it("sanitizes access denial and rejects unknown client fields", async () => {
    const repository = { list: vi.fn(async () => { throw new Error("OPERATIONAL_POLICY_ACCESS_DENIED"); }), history: vi.fn(), propose: vi.fn(), transition: vi.fn() };
    const caller = createOperationalPolicyGovernanceRouter({ actorForContext: async () => actor, repository, now: () => new Date() }).createCaller(context());
    await expect(caller.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.propose({ version: 1, thresholds: policyThresholds, effectiveFrom: new Date(), effectiveTo: null,
      sourceReference: "OWNER", reason: "Draft", role: "OWNER" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
