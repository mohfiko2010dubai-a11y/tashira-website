import type { AuthorizationActor } from "../authorization/policy";
import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { MysqlRuleGovernanceRepository } from "./mysql-rule-governance-repository";
import type { RuleGovernanceAction, RuleVersionStatus } from "./rule-governance";

type Repository = Pick<MysqlRuleGovernanceRepository, "importDraft" | "transition">;
type Context = {
  actor: AuthorizationActor;
  flagContext: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  repository: Repository;
};

function gate(input: Context, permission: "rule.propose" | "rule.review" | "rule.activate"): void {
  if (!isOperationsFlagEnabled("REGULATORY_WATCHER", input.flagContext, input.flags)) throw new Error("RULE_GOVERNANCE_DISABLED");
  if (!input.actor.permissions.has(permission)) throw new Error("RULE_GOVERNANCE_ACCESS_DENIED");
}

export async function importRuleDraft(input: Context & { rule: unknown; commandId: string; now: Date }) {
  gate(input, "rule.propose");
  return input.repository.importDraft(input.rule, input.commandId, input.actor, input.now);
}

export async function transitionRuleVersion(input: Context & {
  ruleVersionId: string;
  expectedStatus: RuleVersionStatus;
  action: RuleGovernanceAction;
  reason: string;
  commandId: string;
  now: Date;
}) {
  const permission = input.action === "SUBMIT_FOR_REVIEW" ? "rule.propose" :
    input.action === "APPROVE" || input.action === "REJECT" ? "rule.review" : "rule.activate";
  gate(input, permission);
  return input.repository.transition({
    ruleVersionId: input.ruleVersionId,
    expectedStatus: input.expectedStatus,
    action: input.action,
    reason: input.reason,
    commandId: input.commandId,
    environment: input.flagContext.environment,
    ownerActivationApproved: false,
    occurredAt: input.now,
  }, input.actor);
}
