import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import { MysqlOperationsAccessProvider, OperationsAccessError } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlSourceAuthorityRepository } from "./lib/rules/mysql-source-authority-repository";
import { sourceAuthorityTypeSchema } from "./lib/rules/source-authority-policy";
import { listSourceAuthorities, reviewSourceAuthority } from "./lib/rules/source-authority-service";
import { createRouter, staffOrAdminQuery } from "./middleware";

type Access = Pick<MysqlOperationsAccessProvider, "actorForContext" | "flagContextForContext" | "featureFlags">;
type Repository = Pick<MysqlSourceAuthorityRepository, "list" | "review">;
type Dependencies = { access: Access; repository: Repository; now(): Date };
async function context(deps: Dependencies, ctx: TrpcContext) { const [actor, flagContext, flags] = await Promise.all([
  deps.access.actorForContext(ctx), deps.access.flagContextForContext(ctx), deps.access.featureFlags()]); return { actor, flagContext, flags, repository: deps.repository }; }
function safe(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof OperationsAccessError || ["SOURCE_AUTHORITY_GOVERNANCE_DISABLED", "SOURCE_AUTHORITY_ACCESS_DENIED"].includes(message))
    throw new TRPCError({ code: "FORBIDDEN", message: "Source authority governance access denied" });
  if (["SOURCE_AUTHORITY_VERSION_CONFLICT", "SOURCE_AUTHORITY_IDEMPOTENCY_CONFLICT"].includes(message))
    throw new TRPCError({ code: "CONFLICT", message: "Source authority record changed; refresh and retry" });
  if (message === "SOURCE_AUTHORITY_SOURCE_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "Rule source not found" });
  throw new TRPCError({ code: "BAD_REQUEST", message: "Source authority review rejected" });
}
export function createSourceAuthorityGovernanceRouter(deps: Dependencies) { return createRouter({
  list: staffOrAdminQuery.input(z.object({}).strict()).query(async ({ ctx }) => { try { return await listSourceAuthorities(await context(deps, ctx)); } catch (error) { safe(error); } }),
  review: staffOrAdminQuery.input(z.object({ sourceId: z.number().int().positive(), expectedLatestEventId: z.string().uuid().nullable(),
    commandId: z.string().uuid(), authorityType: sourceAuthorityTypeSchema, decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUIRED"]),
    reason: z.string().trim().min(3).max(1000) }).strict()).mutation(async ({ ctx, input }) => {
      try { return await reviewSourceAuthority({ ...await context(deps, ctx), ...input, now: deps.now() }); } catch (error) { safe(error); }
    }),
}); }
const access = new MysqlOperationsAccessProvider(defaultOperationsSqlClient());
export const sourceAuthorityGovernanceRouter = createSourceAuthorityGovernanceRouter({ access,
  repository: new MysqlSourceAuthorityRepository(defaultOperationsPool()), now: () => new Date() });
