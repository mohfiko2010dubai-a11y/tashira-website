import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import { MysqlOperationsAccessProvider, OperationsAccessError } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlRuleGovernanceRepository } from "./lib/rules/mysql-rule-governance-repository";
import { visaRuleImportSchema } from "./lib/rules/rule-import";
import { importRuleDraft, listRuleGovernanceHistory, transitionRuleVersion } from "./lib/rules/rule-governance-service";
import { isOperationsFlagEnabled } from "./lib/feature-flags/feature-flags";
import { adminQuery, createRouter, staffOrAdminQuery } from "./middleware";

type Access = Pick<MysqlOperationsAccessProvider, "actorForContext" | "flagContextForContext" | "featureFlags">;
type Repository = Pick<MysqlRuleGovernanceRepository, "list" | "importDraft" | "transition">;
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
    list: staffOrAdminQuery.input(z.object({}).strict()).query(async ({ ctx }) => {
      try { return await listRuleGovernanceHistory(await context(deps, ctx)); } catch (error) { safe(error); }
    }),
    /**
     * Owner/Admin evidence view. This deliberately does not activate Regulatory Watcher:
     * it exposes immutable rule history read-only while every mutation remains protected by
     * the normal feature flag, permission and lifecycle gates.
     */
    adminList: adminQuery.input(z.object({}).strict()).query(async ({ ctx }) => {
      try {
        const evidenceContext = await context(deps, ctx);
        return {
          rows: await deps.repository.list(evidenceContext.actor),
          mutationsEnabled: isOperationsFlagEnabled("REGULATORY_WATCHER", evidenceContext.flagContext, evidenceContext.flags),
        };
      } catch (error) { safe(error); }
    }),
    importDraft: staffOrAdminQuery.input(z.object({ rule: visaRuleImportSchema, commandId: z.string().uuid() }).strict()).mutation(async ({ ctx, input }) => {
      try { return await importRuleDraft({ ...await context(deps, ctx), ...input, now: deps.now() }); } catch (error) { safe(error); }
    }),
    transition: staffOrAdminQuery.input(z.object({ ruleVersionId: z.string().uuid(), expectedStatus: status, action,
      reason: z.string().trim().min(3).max(1000), commandId: z.string().uuid() }).strict()).mutation(async ({ ctx, input }) => {
        try { return await transitionRuleVersion({ ...await context(deps, ctx), ...input, now: deps.now() }); } catch (error) { safe(error); }
      }),
    /** Read-only Staging feature flags for the Owner/Admin UI. Production flags are never returned here. */
    stagingFeatureFlags: adminQuery.input(z.object({}).strict()).query(async ({ ctx }) => {
      const { flags } = await context(deps, ctx);
      return flags.filter((flag) => flag.environment === "STAGING");
    }),
    /** Read-only recent governed rule evaluation runs for the Rule Evaluations screen. */
    recentEvaluations: adminQuery.input(z.object({ limit: z.number().int().min(1).max(200).default(100) }).strict()).query(async ({ input }) => {
      // The limit is bounded by Zod above. Embedding that verified integer avoids MySQL
      // prepared-statement LIMIT coercion failures without accepting any SQL input.
      const rows = await defaultOperationsSqlClient().query(
        `SELECT r.id AS evaluationId, a.reference_number AS referenceNumber, r.applicant_id AS applicantId,
                r.route_code AS routeCode, r.final_eligibility_state AS finalState, r.decision_reason AS decisionReason,
                r.manual_review_reason AS manualReviewReason, r.engine_version AS engineVersion, r.evaluated_at AS evaluatedAt
           FROM visa_rule_evaluation_runs r JOIN applications a ON a.id = r.application_id
          ORDER BY r.evaluated_at DESC, r.id LIMIT ${input.limit}`);
      return rows;
    }),
  });
}
const access = new MysqlOperationsAccessProvider(defaultOperationsSqlClient());
export const ruleGovernanceRouter = createRuleGovernanceRouter({ access, repository: new MysqlRuleGovernanceRepository(defaultOperationsPool()), now: () => new Date() });
