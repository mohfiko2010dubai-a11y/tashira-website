import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import { MysqlOperationsAccessProvider, OperationsAccessError } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlRuleGovernanceRepository } from "./lib/rules/mysql-rule-governance-repository";
import { visaRuleImportSchema } from "./lib/rules/rule-import";
import { importRuleDraft, transitionRuleVersion } from "./lib/rules/rule-governance-service";
import { createRouter, staffOrAdminQuery } from "./middleware";

type Access = Pick<MysqlOperationsAccessProvider, "actorForContext" | "flagContextForContext" | "featureFlags">;
type Repository = Pick<MysqlRuleGovernanceRepository, "importDraft" | "transition">;
type Dependencies = { access: Access; repository: Repository; now(): Date };
async function context(deps: Dependencies, ctx: TrpcContext) {
  const [actor, flagContext, flags] = await Promise.all([deps.access.actorForContext(ctx), deps.access.flagContextForContext(ctx), deps.access.featureFlags()]);
  return { actor, flagContext, flags, repository: deps.repository };
}
function safe(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof OperationsAccessError || ["RULE_GOVERNANCE_DISABLED", "RULE_GOVERNANCE_ACCESS_DENIED"].includes(message))
    throw new TRPCError({ code: "FORBIDDEN", message: "Rule governance access denied" });
  if (["RULE_GOVERNANCE_VERSION_CONFLICT", "RULE_GOVERNANCE_IDEMPOTENCY_CONFLICT", "RULE_ACTIVE_VERSION_CONFLICT", "RULE_VERSION_ALREADY_EXISTS"].includes(message))
    throw new TRPCError({ code: "CONFLICT", message: "Rule version changed; refresh and retry" });
  if (message === "RULE_VERSION_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "Rule version not found" });
  throw new TRPCError({ code: "BAD_REQUEST", message: "Rule governance action rejected" });
}
const status = z.enum(["DRAFT", "UNDER_REVIEW", "APPROVED", "ACTIVE", "RETIRED", "REJECTED"]);
const action = z.enum(["SUBMIT_FOR_REVIEW", "APPROVE", "REJECT", "ACTIVATE", "RETIRE"]);
export function createRuleGovernanceRouter(deps: Dependencies) {
  return createRouter({
    importDraft: staffOrAdminQuery.input(z.object({ rule: visaRuleImportSchema, commandId: z.string().uuid() }).strict()).mutation(async ({ ctx, input }) => {
      try { return await importRuleDraft({ ...await context(deps, ctx), ...input, now: deps.now() }); } catch (error) { safe(error); }
    }),
    transition: staffOrAdminQuery.input(z.object({ ruleVersionId: z.string().uuid(), expectedStatus: status, action,
      reason: z.string().trim().min(3).max(1000), commandId: z.string().uuid() }).strict()).mutation(async ({ ctx, input }) => {
        try { return await transitionRuleVersion({ ...await context(deps, ctx), ...input, now: deps.now() }); } catch (error) { safe(error); }
      }),
  });
}
const access = new MysqlOperationsAccessProvider(defaultOperationsSqlClient());
export const ruleGovernanceRouter = createRuleGovernanceRouter({ access, repository: new MysqlRuleGovernanceRepository(defaultOperationsPool()), now: () => new Date() });
