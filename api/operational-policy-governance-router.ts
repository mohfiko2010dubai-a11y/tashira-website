import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import { MysqlOperationsAccessProvider } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlOperationalPolicyGovernanceRepository } from "./lib/travel/mysql-operational-policy-governance-repository";
import { createRouter, staffOrAdminQuery } from "./middleware";

type Repository = Pick<MysqlOperationalPolicyGovernanceRepository, "propose" | "transition" | "list" | "history">;
type Dependencies = { actorForContext(ctx: TrpcContext): Promise<AuthorizationActor>; repository: Repository; now(): Date };
const thresholds = z.object({ scheduledAfterDays: z.number().int().nonnegative(), recommendedMinDays: z.number().int().nonnegative(),
  recommendedMaxDays: z.number().int().nonnegative(), readyMinDays: z.number().int().nonnegative(), readyMaxDays: z.number().int().nonnegative(),
  urgentMinDays: z.number().int().nonnegative(), urgentMaxDays: z.number().int().nonnegative(), humanReviewMinDays: z.number().int().nonnegative(),
  humanReviewMaxDays: z.number().int().nonnegative(), dueSoonDays: z.number().int().nonnegative(), alertUrgentDays: z.number().int().nonnegative(),
  dueTodayDays: z.literal(0) }).strict();
function safe(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (message === "OPERATIONAL_POLICY_ACCESS_DENIED") throw new TRPCError({ code: "FORBIDDEN", message: "Operational policy access denied" });
  if (["OPERATIONAL_POLICY_VERSION_CONFLICT", "OPERATIONAL_POLICY_TRANSITION_INVALID"].includes(message)) throw new TRPCError({ code: "CONFLICT", message });
  throw new TRPCError({ code: "BAD_REQUEST", message: "Operational policy operation rejected" });
}
export function createOperationalPolicyGovernanceRouter(deps: Dependencies) {
  return createRouter({
    list: staffOrAdminQuery.input(z.object({}).strict()).query(async ({ ctx }) => {
      try { return await deps.repository.list(await deps.actorForContext(ctx)); } catch (error) { safe(error); }
    }),
    history: staffOrAdminQuery.input(z.object({ policyId: z.string().uuid() }).strict()).query(async ({ input, ctx }) => {
      try { return await deps.repository.history(input.policyId, await deps.actorForContext(ctx)); } catch (error) { safe(error); }
    }),
    propose: staffOrAdminQuery.input(z.object({ version: z.number().int().positive(), thresholds, effectiveFrom: z.coerce.date(),
      effectiveTo: z.coerce.date().nullable(), sourceReference: z.string().trim().min(3).max(255), reason: z.string().trim().min(3).max(1000) }).strict())
      .mutation(async ({ input, ctx }) => {
        try { return await deps.repository.propose(input, await deps.actorForContext(ctx), deps.now()); } catch (error) { safe(error); }
      }),
    transition: staffOrAdminQuery.input(z.object({ policyId: z.string().uuid(), expectedVersion: z.number().int().positive(),
      toState: z.enum(["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "REJECTED", "SUPERSEDED"]),
      reason: z.string().trim().min(3).max(1000) }).strict()).mutation(async ({ input, ctx }) => {
      try { return await deps.repository.transition(input, await deps.actorForContext(ctx), deps.now()); } catch (error) { safe(error); }
    }),
  });
}

let access: MysqlOperationsAccessProvider | undefined; let repository: MysqlOperationalPolicyGovernanceRepository | undefined;
function accessProvider() { return access ??= new MysqlOperationsAccessProvider(defaultOperationsSqlClient()); }
function policyRepository() { return repository ??= new MysqlOperationalPolicyGovernanceRepository(defaultOperationsPool()); }
export const operationalPolicyGovernanceRouter = createOperationalPolicyGovernanceRouter({
  actorForContext: (ctx) => accessProvider().actorForContext(ctx), repository: policyRepository(), now: () => new Date(),
});
