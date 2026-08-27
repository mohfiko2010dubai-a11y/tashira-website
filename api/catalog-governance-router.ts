import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import { MysqlOperationsAccessProvider } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlCatalogGovernanceRepository } from "./lib/requirements/mysql-catalog-governance-repository";
import { createRouter, staffOrAdminQuery } from "./middleware";

type Repository = Pick<MysqlCatalogGovernanceRepository, "importDraft" | "editDraft" | "transition" | "list">;
type Dependencies = { actorForContext(ctx: TrpcContext): Promise<AuthorizationActor>; repository: Repository; now(): Date };
function safeError(error: unknown): never {
  if (error instanceof Error && error.message === "CATALOG_GOVERNANCE_ACCESS_DENIED") throw new TRPCError({ code: "FORBIDDEN", message: "Catalog access denied" });
  if (error instanceof Error && ["CATALOG_VERSION_CONFLICT", "CATALOG_TRANSITION_INVALID"].includes(error.message)) throw new TRPCError({ code: "CONFLICT", message: error.message });
  throw new TRPCError({ code: "BAD_REQUEST", message: "Catalog operation rejected" });
}
export function createCatalogGovernanceRouter(deps: Dependencies) {
  return createRouter({
    list: staffOrAdminQuery.input(z.object({}).strict()).query(async ({ ctx }) => {
      try { return await deps.repository.list(await deps.actorForContext(ctx)); } catch (error) { safeError(error); }
    }),
    importDraft: staffOrAdminQuery.input(z.object({ catalog: z.unknown() }).strict()).mutation(async ({ input, ctx }) => {
      try { return await deps.repository.importDraft(input.catalog, await deps.actorForContext(ctx), deps.now()); } catch (error) { safeError(error); }
    }),
    editDraft: staffOrAdminQuery.input(z.object({ definitionId: z.string().uuid(), kind: z.enum(["REQUIREMENT", "QUESTION"]),
      expectedVersion: z.number().int().positive(), customerLabel: z.string().trim().min(1).max(200),
      shortCustomerExplanation: z.string().trim().min(1).max(500), internalLabel: z.string().trim().min(1).max(200),
      classification: z.enum(["OFFICIAL", "OPERATIONAL", "CONDITIONAL", "OPTIONAL", "INTERNAL"]), authoritySemantics: z.string().trim().max(500).nullable(),
      reasonTemplate: z.string().trim().min(1).max(500), effectiveFrom: z.coerce.date(), effectiveTo: z.coerce.date().nullable(),
      reason: z.string().trim().min(3).max(500) }).strict()).mutation(async ({ input, ctx }) => {
      try { return await deps.repository.editDraft(input, await deps.actorForContext(ctx), deps.now()); } catch (error) { safeError(error); }
    }),
    transition: staffOrAdminQuery.input(z.object({ definitionId: z.string().uuid(), kind: z.enum(["REQUIREMENT", "QUESTION"]),
      expectedVersion: z.number().int().positive(), toState: z.enum(["DRAFT", "REVIEW", "APPROVED", "ACTIVE", "REJECTED", "SUPERSEDED", "RETIRED"]),
      reason: z.string().trim().min(3).max(500) }).strict()).mutation(async ({ input, ctx }) => {
      try { return await deps.repository.transition(input, await deps.actorForContext(ctx), deps.now()); } catch (error) { safeError(error); }
    }),
  });
}
let access: MysqlOperationsAccessProvider | undefined; let repository: MysqlCatalogGovernanceRepository | undefined;
function accessProvider() { return access ??= new MysqlOperationsAccessProvider(defaultOperationsSqlClient()); }
function catalogRepository() { return repository ??= new MysqlCatalogGovernanceRepository(defaultOperationsPool()); }
export const catalogGovernanceRouter = createCatalogGovernanceRouter({ actorForContext: (ctx) => accessProvider().actorForContext(ctx), repository: catalogRepository(), now: () => new Date() });
