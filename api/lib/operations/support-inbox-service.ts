import { authorize, type AuthorizationActor } from "../authorization/policy";
import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { SupportCommand } from "./support-workflow";
import type { SupportThreadDetail, SupportThreadResource } from "./mysql-support-inbox-repository";

export type SupportInboxRepository = {
  list(): Promise<readonly SupportThreadResource[]>;
  get(threadId: string): Promise<SupportThreadDetail | null>;
  apply(threadId: string, command: SupportCommand): Promise<SupportThreadDetail>;
};

type Context = { actor: AuthorizationActor; context: FeatureFlagContext; flags: readonly FeatureFlagRecord[]; repository: SupportInboxRepository };
function enabled(input: Context): void { if (!isOperationsFlagEnabled("SUPPORT_INBOX", input.context, input.flags)) throw new Error("SUPPORT_INBOX_DISABLED"); }
function staffId(actor: AuthorizationActor): number { const match = /^staff:([1-9]\d*)$/.exec(actor.id); if (!match) throw new Error("SUPPORT_STAFF_ACTOR_REQUIRED"); return Number(match[1]); }
function allowed(actor: AuthorizationActor, permission: "support.read" | "support.reply", resource: SupportThreadResource): boolean {
  if (resource.applicationOwnerActorId !== undefined) {
    const operationPermission = permission === 'support.read' ? 'case.read_assigned' : 'case.transition';
    if (actor.scopes.includes('ALL')) return actor.permissions.has(permission);
    return resource.applicationOwnerActorId === actor.id && actor.permissions.has(operationPermission)
      && authorize(actor, operationPermission, { assignedActorId: resource.applicationOwnerActorId }).allowed;
  }
  return actor.permissions.has(permission) && authorize(actor, permission, resource).allowed;
}

export async function listSupportThreads(input: Context): Promise<readonly SupportThreadResource[]> {
  enabled(input); if (!input.actor.permissions.has("support.read") && !input.actor.permissions.has('case.read_assigned')) throw new Error("SUPPORT_ACCESS_DENIED");
  return (await input.repository.list()).filter((thread) => allowed(input.actor, "support.read", thread));
}

export async function readSupportThread(input: Context & { threadId: string }): Promise<SupportThreadDetail> {
  enabled(input); const thread = await input.repository.get(input.threadId);
  if (!thread || !allowed(input.actor, "support.read", thread)) throw new Error("SUPPORT_ACCESS_DENIED");
  return thread;
}

export async function executeSupportCommand(input: Context & { threadId: string; command: Omit<SupportCommand, "actorStaffId" | "occurredAt">; now: Date }): Promise<SupportThreadDetail> {
  enabled(input); const current = await input.repository.get(input.threadId);
  if (!current || !allowed(input.actor, "support.reply", current)) throw new Error("SUPPORT_ACCESS_DENIED");
  if (current.applicationOwnerActorId !== undefined && ['ASSIGN','REASSIGN','CLAIM'].includes(input.command.action)) throw new Error('SUPPORT_USE_CASE_ASSIGNMENT');
  return input.repository.apply(input.threadId, { ...input.command, actorStaffId: staffId(input.actor), occurredAt: input.now.toISOString() });
}
