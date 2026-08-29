import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import { createRuleGovernanceRouter } from "./rule-governance-router";

const request = new Request("https://staging.invalid/api/trpc");
const context = (input: Partial<TrpcContext>): TrpcContext => ({
  req: request,
  resHeaders: new Headers(),
  isAdmin: false,
  customerApplicationReferences: new Set(),
  ...input,
});

function dependencies() {
  const actor: AuthorizationActor = { id: "admin", permissions: new Set(["rule.read"]), scopes: ["ALL"],
    teamIds: new Set<number>(), departmentIds: new Set<number>() };
  const access = {
    actorForContext: vi.fn(async () => actor),
    flagContextForContext: vi.fn(async () => ({ environment: "STAGING" as const })),
    featureFlags: vi.fn(async () => [
      { flagKey: "VISA_RULES_EVALUATION" as const, environment: "STAGING" as const, enabled: true, scopeType: "GLOBAL" as const, scopeReference: "" },
      { flagKey: "VISA_RULES_EVALUATION" as const, environment: "PRODUCTION" as const, enabled: false, scopeType: "GLOBAL" as const, scopeReference: "" },
    ]),
  };
  const repository = { list: vi.fn(async () => []), importDraft: vi.fn(), transition: vi.fn() };
  return { access, repository, now: () => new Date("2026-08-30T00:00:00Z") };
}

describe("rule governance Admin projections", () => {
  it("denies ordinary staff access to Staging flags and cross-case evaluation evidence", async () => {
    const caller = createRuleGovernanceRouter(dependencies()).createCaller(context({ staffId: 7 }));
    await expect(caller.stagingFeatureFlags({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.adminList({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.recentEvaluations({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns only Staging flags to an authenticated Admin", async () => {
    const deps = dependencies();
    const caller = createRuleGovernanceRouter(deps).createCaller(context({ isAdmin: true }));
    await expect(caller.stagingFeatureFlags({})).resolves.toEqual([
      expect.objectContaining({ environment: "STAGING", flagKey: "VISA_RULES_EVALUATION" }),
    ]);
  });

  it("returns immutable rule evidence read-only while Regulatory Watcher is off", async () => {
    const deps = dependencies();
    deps.repository.list.mockResolvedValueOnce([{ ruleVersionId: "rule-version" }] as never);
    const caller = createRuleGovernanceRouter(deps).createCaller(context({ isAdmin: true }));

    await expect(caller.adminList({})).resolves.toEqual({
      rows: [{ ruleVersionId: "rule-version" }],
      mutationsEnabled: false,
    });
    expect(deps.repository.list).toHaveBeenCalledTimes(1);
  });
});
