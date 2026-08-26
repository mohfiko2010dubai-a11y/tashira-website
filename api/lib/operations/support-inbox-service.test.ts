import { describe, expect, it } from "vitest";
import type { AuthorizationActor } from "../authorization/policy";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { SupportThreadDetail } from "./mysql-support-inbox-repository";
import { executeSupportCommand, listSupportThreads, readSupportThread, type SupportInboxRepository } from "./support-inbox-service";

const flag: FeatureFlagRecord = { flagKey: "SUPPORT_INBOX", environment: "TEST", enabled: true, scopeType: "TEAM", scopeReference: "7" };
const globalFlag: FeatureFlagRecord = { ...flag, scopeType: "GLOBAL", scopeReference: "" };
const actor = (permissions = ["support.read", "support.reply"], teamIds = [7]): AuthorizationActor => ({ id: "staff:4", permissions: new Set(permissions as ("support.read" | "support.reply")[]), scopes: ["TEAM"], teamIds: new Set(teamIds), departmentIds: new Set() });
const detail = (teamId = 7): SupportThreadDetail => ({ threadId: "thread-1", applicationId: 1, customerReference: "TSH-1", state: "UNASSIGNED", priority: "HIGH",
  assignedStaffId: null, unreadCount: 1, slaDueAt: "2026-08-27T00:00:00.000Z", version: 0, updatedAt: "2026-08-26T00:00:00.000Z",
  internalNotes: [], teamId, departmentId: 2, messages: [] });
function repository(): SupportInboxRepository & { applied: unknown[] } { const applied: unknown[] = []; return { applied, list: async () => [detail(7), detail(8)],
  get: async () => detail(7), apply: async (_id, command) => { applied.push(command); return { ...detail(7), version: 1 }; } }; }
const context = (repo: SupportInboxRepository, currentActor = actor(), flags = [flag]) => ({ actor: currentActor, context: { environment: "TEST" as const, staffId: 4, teamIds: currentActor.teamIds }, flags, repository: repo });

describe("Support Inbox service gate", () => {
  it("returns only trusted team-scoped threads", async () => expect(await listSupportThreads(context(repository()))).toHaveLength(1));
  it("denies closed flags, missing permissions and wrong teams", async () => {
    await expect(listSupportThreads(context(repository(), actor(), []))).rejects.toThrow("SUPPORT_INBOX_DISABLED");
    await expect(readSupportThread({ ...context(repository(), actor([], [7])), threadId: "thread-1" })).rejects.toThrow("SUPPORT_ACCESS_DENIED");
    await expect(readSupportThread({ ...context(repository(), actor(["support.read"], [8]), [globalFlag]), threadId: "thread-1" })).rejects.toThrow("SUPPORT_ACCESS_DENIED");
  });
  it("derives actor identity and time server-side for commands", async () => { const repo = repository();
    await executeSupportCommand({ ...context(repo), threadId: "thread-1", command: { commandId: "cmd-1", expectedVersion: 0, action: "CLAIM" }, now: new Date("2026-08-26T12:00:00Z") });
    expect(repo.applied[0]).toMatchObject({ actorStaffId: 4, occurredAt: "2026-08-26T12:00:00.000Z" });
  });
});
