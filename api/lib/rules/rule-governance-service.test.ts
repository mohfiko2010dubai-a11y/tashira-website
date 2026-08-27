import { describe, expect, it, vi } from "vitest";
import type { AuthorizationActor } from "../authorization/policy";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import { importRuleDraft, listRuleGovernanceHistory, transitionRuleVersion } from "./rule-governance-service";

const actor = (permissions: readonly ("rule.propose" | "rule.review" | "rule.activate")[]): AuthorizationActor => ({
  id: "staff:7", permissions: new Set(permissions), scopes: ["ALL"], teamIds: new Set(), departmentIds: new Set(),
});
const enabled: FeatureFlagRecord = { flagKey: "REGULATORY_WATCHER", environment: "TEST", enabled: true, scopeType: "GLOBAL", scopeReference: "" };
const repository = () => ({
  list: vi.fn(async () => []),
  importDraft: vi.fn(async () => ({ ruleVersionId: "v1", stableId: "RULE_1", version: 1, status: "DRAFT" as const, eventId: "c1" })),
  transition: vi.fn(async () => ({ ruleVersionId: "v1", stableId: "RULE_1", version: 1, status: "UNDER_REVIEW" as const, eventId: "c2" })),
});
const base = (repo = repository()) => ({ actor: actor(["rule.propose", "rule.review", "rule.activate"]),
  flagContext: { environment: "TEST" as const }, flags: [enabled], repository: repo });

describe("rule governance service", () => {
  it("permits only rule readers to inspect immutable lifecycle history", async () => {
    const repo = repository();
    await expect(listRuleGovernanceHistory({ ...base(repo), actor: actor([]) })).rejects.toThrow("RULE_GOVERNANCE_ACCESS_DENIED");
    await expect(listRuleGovernanceHistory({ ...base(repo), actor: actor(["rule.propose"]) })).rejects.toThrow("RULE_GOVERNANCE_ACCESS_DENIED");
    await listRuleGovernanceHistory({ ...base(repo), actor: { ...actor([]), permissions: new Set(["rule.read"]) } });
    expect(repo.list).toHaveBeenCalledTimes(1);
  });
  it("fails closed while the regulatory watcher is disabled", async () => {
    await expect(importRuleDraft({ ...base(), flags: [], rule: {}, commandId: "c1", now: new Date() })).rejects.toThrow("RULE_GOVERNANCE_DISABLED");
  });

  it("separates proposal, review, and activation permissions", async () => {
    await expect(importRuleDraft({ ...base(), actor: actor(["rule.review"]), rule: {}, commandId: "c1", now: new Date() })).rejects.toThrow("RULE_GOVERNANCE_ACCESS_DENIED");
    await expect(transitionRuleVersion({ ...base(), actor: actor(["rule.propose"]), ruleVersionId: "v1", expectedStatus: "UNDER_REVIEW",
      action: "APPROVE", reason: "Reviewed", commandId: "c2", now: new Date() })).rejects.toThrow("RULE_GOVERNANCE_ACCESS_DENIED");
  });

  it("derives the environment and permanently closes the production activation owner gate", async () => {
    const repo = repository();
    const productionFlag: FeatureFlagRecord = { ...enabled, environment: "PRODUCTION" };
    await transitionRuleVersion({ ...base(repo), flags: [productionFlag], flagContext: { environment: "PRODUCTION" }, ruleVersionId: "v1", expectedStatus: "APPROVED",
      action: "ACTIVATE", reason: "Owner approval is not accepted from API", commandId: "c3", now: new Date("2026-08-27T12:00:00Z") });
    expect(repo.transition).toHaveBeenCalledWith(expect.objectContaining({ environment: "PRODUCTION", ownerActivationApproved: false }), expect.objectContaining({ id: "staff:7" }));
  });
});
