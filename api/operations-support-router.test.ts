import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import type { SupportThreadDetail } from "./lib/operations/mysql-support-inbox-repository";
import type { SupportInboxRepository } from "./lib/operations/support-inbox-service";
import { createOperationsSupportRouter } from "./operations-support-router";

const ctx = (staffId?: number): TrpcContext => ({ req: new Request("https://staging.invalid"), resHeaders: new Headers(), isAdmin: false, staffId, customerApplicationReferences: new Set() });
const flag: FeatureFlagRecord = { flagKey: "SUPPORT_INBOX", environment: "STAGING", enabled: true, scopeType: "TEAM", scopeReference: "7" };
const actor: AuthorizationActor = { id: "staff:4", permissions: new Set(["support.read","support.reply"]), scopes: ["TEAM"], teamIds: new Set([7]), departmentIds: new Set() };
const thread: SupportThreadDetail = { threadId: "11111111-1111-4111-8111-111111111111", applicationId: 1, customerReference: "TSH-1", state: "UNASSIGNED", priority: "NORMAL",
  assignedStaffId: null, unreadCount: 0, slaDueAt: "2026-08-27T00:00:00.000Z", version: 0, updatedAt: "2026-08-26T00:00:00.000Z", internalNotes: [], teamId: 7, messages: [] };
function setup(flags: readonly FeatureFlagRecord[] = [flag]) { const commands: unknown[] = []; const repository: SupportInboxRepository = { list: async () => [thread], get: async () => thread,
  apply: async (_id, command) => { commands.push(command); return { ...thread, version: 1 }; } };
  const access = { actorForContext: async () => actor, flagContextForContext: async () => ({ environment: "STAGING" as const, staffId: 4, teamIds: new Set([7]) }), featureFlags: async () => flags };
  return { commands, router: createOperationsSupportRouter({ access, repository, now: () => new Date("2026-08-26T12:00:00Z") }) }; }

describe("Operations Support router", () => {
  it("requires staff and a scoped enabled flag", async () => { await expect(setup().router.createCaller(ctx()).list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setup([]).router.createCaller(ctx(4)).list({})).rejects.toMatchObject({ code: "FORBIDDEN" }); });
  it("returns the scoped thread and derives command actor server-side", async () => { const value = setup();
    expect(await value.router.createCaller(ctx(4)).detail({ threadId: thread.threadId })).toMatchObject({ threadId: thread.threadId });
    await value.router.createCaller(ctx(4)).command({ threadId: thread.threadId, command: { commandId: "command-123", expectedVersion: 0, action: "CLAIM" } });
    expect(value.commands[0]).toMatchObject({ actorStaffId: 4, occurredAt: "2026-08-26T12:00:00.000Z" }); });
  it("rejects client-provided authorization or actor fields", async () => { await expect(setup().router.createCaller(ctx(4)).command({ threadId: thread.threadId,
    command: { commandId: "command-123", expectedVersion: 0, action: "CLAIM", actorStaffId: 999 } as never })).rejects.toMatchObject({ code: "BAD_REQUEST" }); });
});
