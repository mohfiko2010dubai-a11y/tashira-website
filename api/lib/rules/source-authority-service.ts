import type { AuthorizationActor } from "../authorization/policy";
import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { MysqlSourceAuthorityRepository, ReviewSourceAuthorityCommand } from "./mysql-source-authority-repository";

type Repository = Pick<MysqlSourceAuthorityRepository, "list" | "review">;
type Context = { actor: AuthorizationActor; flagContext: FeatureFlagContext; flags: readonly FeatureFlagRecord[]; repository: Repository };
function gate(input: Context, permission: "rule.read" | "rule.review"): void {
  if (!isOperationsFlagEnabled("REGULATORY_WATCHER", input.flagContext, input.flags)) throw new Error("SOURCE_AUTHORITY_GOVERNANCE_DISABLED");
  if (!input.actor.permissions.has(permission)) throw new Error("SOURCE_AUTHORITY_ACCESS_DENIED");
}
export async function listSourceAuthorities(input: Context) { gate(input, "rule.read"); return input.repository.list(input.actor); }
export async function reviewSourceAuthority(input: Context & Omit<ReviewSourceAuthorityCommand, "occurredAt"> & { now: Date }) {
  gate(input, "rule.review"); return input.repository.review({ ...input, occurredAt: input.now }, input.actor);
}
