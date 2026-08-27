import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import type { SourceAuthorityRecord } from "./lib/rules/mysql-source-authority-repository";
import { createSourceAuthorityGovernanceRouter } from "./source-authority-governance-router";

const actor: AuthorizationActor = { id: "staff:7", permissions: new Set(["rule.read", "rule.review"]), scopes: ["ALL"], teamIds: new Set(), departmentIds: new Set() };
const flag: FeatureFlagRecord = { flagKey: "REGULATORY_WATCHER", environment: "TEST", enabled: true, scopeType: "GLOBAL", scopeReference: "" };
const ctx = (): TrpcContext => ({ req: new Request("https://internal.invalid/api/trpc"), resHeaders: new Headers(), isAdmin: false, staffId: 7, customerApplicationReferences: new Set() });
const source: SourceAuthorityRecord = { sourceId: 1, authority: "Synthetic Authority", title: "Synthetic source", sourceUrl: "https://example.invalid/source",
  classification: "OFFICIAL", sourceState: "ACTIVE", latestEventId: null, policyVersion: null, authorityType: null, decision: null,
  actorReference: null, reason: null, occurredAt: null };
function dependencies() { const repository = { list: vi.fn(async () => [source]), review: vi.fn(async () => ({ ...source,
  latestEventId: "11111111-1111-4111-8111-111111111111", policyVersion: "UAE_OFFICIAL_SOURCE_POLICY_V1", authorityType: "ICP" as const,
  decision: "APPROVED" as const, actorReference: actor.id, reason: "Official source reviewed", occurredAt: "2026-08-27T10:00:00.000Z" })) };
  return { repository, deps: { access: { actorForContext: async () => actor, flagContextForContext: async () => ({ environment: "TEST" as const }),
    featureFlags: async () => [flag] }, repository, now: () => new Date("2026-08-27T10:00:00Z") } }; }

describe("source authority governance router", () => {
  it("exposes read and review only through trusted RBAC/flag context", async () => {
    const { deps, repository } = dependencies(), caller = createSourceAuthorityGovernanceRouter(deps).createCaller(ctx());
    await expect(caller.list({})).resolves.toEqual([source]);
    const command = { sourceId: 1, expectedLatestEventId: null, commandId: "11111111-1111-4111-8111-111111111111",
      authorityType: "ICP" as const, decision: "APPROVED" as const, reason: "Official source reviewed" };
    await caller.review(command);
    expect(repository.review).toHaveBeenCalledWith(expect.objectContaining({ ...command, occurredAt: new Date("2026-08-27T10:00:00Z") }), actor);
  });
  it("rejects unknown fields and sanitizes persistence errors", async () => {
    const { deps, repository } = dependencies(); repository.review = vi.fn(async () => { throw new Error("SELECT secret_key FROM env"); });
    const caller = createSourceAuthorityGovernanceRouter(deps).createCaller(ctx());
    await expect(caller.review({ sourceId: 1, expectedLatestEventId: null, commandId: "11111111-1111-4111-8111-111111111111",
      authorityType: "ICP", decision: "APPROVED", reason: "Official source reviewed", role: "OWNER" } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.review({ sourceId: 1, expectedLatestEventId: null, commandId: "11111111-1111-4111-8111-111111111111",
      authorityType: "ICP", decision: "APPROVED", reason: "Official source reviewed" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Source authority review rejected" });
  });
});
