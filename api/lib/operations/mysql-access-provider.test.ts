import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../context";
import { isOperationsFlagEnabled } from "../feature-flags/feature-flags";
import {
  MysqlOperationsAccessProvider,
  OperationsAccessError,
  runtimeFlagEnvironment,
  type OperationsSqlClient,
} from "./mysql-access-provider";

function context(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    req: new Request("https://internal.invalid", { headers: { "x-operations-role": "OWNER", "x-staff-id": "999" } }),
    resHeaders: new Headers(),
    isAdmin: false,
    customerApplicationReferences: new Set(),
    ...overrides,
  };
}

function client(responses: readonly (readonly object[])[]): OperationsSqlClient {
  let index = 0;
  return { query: vi.fn(async () => responses[index++] ?? []) };
}

describe("MysqlOperationsAccessProvider", () => {
  it("loads a trusted staff actor from persisted roles and scopes", async () => {
    const provider = new MysqlOperationsAccessProvider(client([
      [{ code: "case.transition" }, { code: "document.review" }],
      [{ scopeType: "TEAM", teamId: 7, departmentId: null }],
    ]));
    const actor = await provider.actorForContext(context({ staffId: 42 }));
    expect(actor.id).toBe("staff:42");
    expect([...actor.permissions]).toEqual(["case.transition", "document.review"]);
    expect([...actor.teamIds]).toEqual([7]);
  });

  it("ignores spoofed role and staff headers and requires trusted context identity", async () => {
    const provider = new MysqlOperationsAccessProvider(client([]));
    await expect(provider.actorForContext(context())).rejects.toMatchObject({ code: "ACTOR_REQUIRED" });
  });

  it("denies actors with missing, malformed, or empty persisted grants", async () => {
    const provider = new MysqlOperationsAccessProvider(client([
      [{ code: "not.a.permission" }],
      [{ scopeType: "ROOT", teamId: null, departmentId: null }],
    ]));
    await expect(provider.actorForContext(context({ staffId: 4 }))).rejects.toMatchObject({ code: "ACTOR_ACCESS_DENIED" });
  });

  it("sanitizes database failures", async () => {
    const sql: OperationsSqlClient = { query: vi.fn(async () => { throw new Error("SELECT secret FROM production"); }) };
    await expect(new MysqlOperationsAccessProvider(sql).actorForContext(context({ staffId: 4 })))
      .rejects.toEqual(new OperationsAccessError("ACCESS_PROVIDER_UNAVAILABLE"));
  });

  it("grants the authenticated administrator explicit owner authority without client headers", async () => {
    const provider = new MysqlOperationsAccessProvider(client([]));
    const actor = await provider.actorForContext(context({ isAdmin: true }));
    expect(actor.scopes).toEqual(["ALL"]);
    expect(actor.permissions.has("role.manage")).toBe(true);
  });

  it("loads only valid feature flags and fails malformed records closed", async () => {
    const provider = new MysqlOperationsAccessProvider(client([[
      { flagKey: "OPERATIONS_CONTROLLED_WRITES", environment: "TEST", enabled: "YES", scopeType: "TEAM", scopeReference: "7" },
      { flagKey: "OPERATIONS_CONTROLLED_WRITES", environment: "TEST", enabled: "MAYBE", scopeType: "GLOBAL", scopeReference: "" },
      { flagKey: "UNKNOWN", environment: "TEST", enabled: "YES", scopeType: "GLOBAL", scopeReference: "" },
      { flagKey: "OPERATIONS_CONTROLLED_WRITES", environment: "TEST", enabled: "YES", scopeType: "GLOBAL", scopeReference: "not-empty" },
    ]]));
    const records = await provider.featureFlags();
    expect(records).toHaveLength(1);
    expect(isOperationsFlagEnabled("OPERATIONS_CONTROLLED_WRITES", { environment: "TEST", teamIds: new Set([7]) }, records)).toBe(true);
    expect(isOperationsFlagEnabled("OPERATIONS_CONTROLLED_WRITES", { environment: "TEST", teamIds: new Set([8]) }, records)).toBe(false);
  });

  it("treats missing flags and provider failures as disabled", async () => {
    const missing = await new MysqlOperationsAccessProvider(client([[]])).featureFlags();
    expect(isOperationsFlagEnabled("OPERATIONS_CONTROLLED_WRITES", { environment: "TEST" }, missing)).toBe(false);
    const failing: OperationsSqlClient = { query: vi.fn(async () => { throw new Error("unavailable"); }) };
    const failed = await new MysqlOperationsAccessProvider(failing).featureFlags();
    expect(failed).toEqual([]);
  });

  it("maps runtime environment conservatively", () => {
    expect(runtimeFlagEnvironment("production")).toBe("PRODUCTION");
    expect(runtimeFlagEnvironment("test")).toBe("TEST");
    expect(runtimeFlagEnvironment("unexpected")).toBe("DEVELOPMENT");
  });

  it("loads team scope for flag evaluation without granting actor permissions", async () => {
    const provider = new MysqlOperationsAccessProvider(client([[
      { teamId: 9 }, { teamId: "10" }, { teamId: "invalid" },
    ]]));
    const flagContext = await provider.flagContextForContext(context({ staffId: 42 }));
    expect([...(flagContext.teamIds ?? [])]).toEqual([9, 10]);
  });
});
