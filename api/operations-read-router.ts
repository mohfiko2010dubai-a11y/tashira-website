import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { FeatureFlagContext, FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import { MysqlOperationsAccessProvider, OperationsAccessError } from "./lib/operations/mysql-access-provider";
import { MysqlOperationsCaseReadProvider, type MysqlOperationsCaseBundle } from "./lib/operations/mysql-case-read-provider";
import { readOperationsCase } from "./lib/operations/case-read-service";
import { defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { createRouter, staffOrAdminQuery } from "./middleware";

type Dependencies = {
  actorForContext(ctx: TrpcContext): Promise<AuthorizationActor>;
  flagContextForContext(ctx: TrpcContext): FeatureFlagContext | Promise<FeatureFlagContext>;
  flagsForContext(ctx: TrpcContext): Promise<readonly FeatureFlagRecord[]>;
  load(reference: string): Promise<MysqlOperationsCaseBundle | null>;
};

export function createOperationsReadRouter(deps: Dependencies) {
  return createRouter({
    caseByReference: staffOrAdminQuery
      .input(z.object({ reference: z.string().trim().min(3).max(50) }).strict())
      .query(async ({ input, ctx }) => {
        // Admin cookies are not a substitute for an explicitly scoped Operations staff identity.
        if (!ctx.staffId) throw new TRPCError({ code: "FORBIDDEN", message: "Operations access denied" });
        try {
          const [actor, context, flags] = await Promise.all([
            deps.actorForContext(ctx), deps.flagContextForContext(ctx), deps.flagsForContext(ctx),
          ]);
          const bundle = await deps.load(input.reference);
          if (!bundle) throw new TRPCError({ code: "NOT_FOUND", message: "Operations case not found" });
          return readOperationsCase({ actor, context, flags, ...bundle });
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          if (error instanceof OperationsAccessError
            || error instanceof Error && ["OPERATIONS_CASE_ACCESS_DENIED", "OPERATIONS_CASE_READ_MODEL_DISABLED"].includes(error.message)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Operations access denied" });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Operations case unavailable" });
        }
      }),
  });
}

let access: MysqlOperationsAccessProvider | undefined;
let reader: MysqlOperationsCaseReadProvider | undefined;
function accessProvider() { return access ??= new MysqlOperationsAccessProvider(defaultOperationsSqlClient()); }
function readProvider() { return reader ??= new MysqlOperationsCaseReadProvider(defaultOperationsSqlClient()); }

export const operationsReadRouter = createOperationsReadRouter({
  actorForContext: (ctx) => accessProvider().actorForContext(ctx),
  flagContextForContext: (ctx) => accessProvider().flagContextForContext(ctx),
  flagsForContext: () => accessProvider().featureFlags(),
  load: (reference) => readProvider().load(reference),
});
