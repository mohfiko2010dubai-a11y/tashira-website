import { describe, expect, it, vi } from "vitest";
import type { AuthorizationActor } from "../authorization/policy";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import { listSourceAuthorities, reviewSourceAuthority } from "./source-authority-service";

const flag: FeatureFlagRecord = { flagKey: "REGULATORY_WATCHER", environment: "TEST", enabled: true, scopeType: "GLOBAL", scopeReference: "" };
const actor = (permissions: ("rule.read" | "rule.review")[]): AuthorizationActor => ({ id: "staff:7", permissions: new Set(permissions), scopes: ["ALL"], teamIds: new Set(), departmentIds: new Set() });
const reviewed = { sourceId: 1, authority: "Synthetic Authority", title: "Synthetic source", sourceUrl: "https://example.invalid/source",
  classification: "OFFICIAL" as const, sourceState: "ACTIVE" as const, latestEventId: crypto.randomUUID(),
  policyVersion: "UAE_OFFICIAL_SOURCE_POLICY_V1", authorityType: "ICP" as const, decision: "APPROVED" as const,
  actorReference: "staff:7", reason: "Official evidence reviewed", occurredAt: "2026-08-27T10:00:00.000Z" };
const repository = { list: vi.fn(async () => []), review: vi.fn(async () => reviewed) };
const base = { actor: actor(["rule.read", "rule.review"]), flagContext: { environment: "TEST" as const }, flags: [flag], repository };

describe("source authority governance service", () => {
  it("fails closed while the watcher flag is disabled", async () => {
    await expect(listSourceAuthorities({ ...base, flags: [] })).rejects.toThrow("SOURCE_AUTHORITY_GOVERNANCE_DISABLED");
  });
  it("separates read and review permissions", async () => {
    await expect(listSourceAuthorities({ ...base, actor: actor([]) })).rejects.toThrow("SOURCE_AUTHORITY_ACCESS_DENIED");
    await expect(reviewSourceAuthority({ ...base, actor: actor(["rule.read"]), sourceId: 1, expectedLatestEventId: null,
      commandId: crypto.randomUUID(), authorityType: "ICP", decision: "APPROVED", reason: "Official evidence reviewed", now: new Date() }))
      .rejects.toThrow("SOURCE_AUTHORITY_ACCESS_DENIED");
  });
  it("derives actor and timestamp through the trusted service boundary", async () => {
    const now = new Date("2026-08-27T10:00:00Z"), commandId = crypto.randomUUID(); repository.review.mockClear();
    await reviewSourceAuthority({ ...base, sourceId: 1, expectedLatestEventId: null, commandId, authorityType: "ICP",
      decision: "APPROVED", reason: "Official evidence reviewed", now });
    expect(repository.review).toHaveBeenCalledWith(expect.objectContaining({ commandId, occurredAt: now }), base.actor);
  });
});
