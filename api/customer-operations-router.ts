import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import { assertApplicationReferenceAccess } from "./lib/application-authorization";
import { buildCustomerPortalFromRuntime } from "./lib/customer/customer-portal-runtime";
import type { FeatureFlagContext, FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import { isOperationsFlagEnabled } from "./lib/feature-flags/feature-flags";
import { MysqlOperationsAccessProvider } from "./lib/operations/mysql-access-provider";
import { MysqlOperationsCaseReadProvider, type MysqlOperationsCaseBundle } from "./lib/operations/mysql-case-read-provider";
import { defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { applicationAccessQuery, createRouter } from "./middleware";

type Dependencies = {
  flagContextForContext(ctx: TrpcContext): FeatureFlagContext | Promise<FeatureFlagContext>;
  flagsForContext(ctx: TrpcContext): Promise<readonly FeatureFlagRecord[]>;
  load(reference: string): Promise<MysqlOperationsCaseBundle | null>;
};

export function createCustomerOperationsRouter(deps: Dependencies) {
  return createRouter({
    portal: applicationAccessQuery
      .input(z.object({ referenceNumber: z.string().trim().min(3).max(50) }).strict())
      .query(async ({ input, ctx }) => {
        assertApplicationReferenceAccess(ctx, input.referenceNumber);
        const customerAuthorized = ctx.customerApplicationReferences.has(input.referenceNumber);
        if (!customerAuthorized) throw new TRPCError({ code: "FORBIDDEN", message: "Customer portal access denied" });
        try {
          const [baseContext, flags] = await Promise.all([
            deps.flagContextForContext(ctx), deps.flagsForContext(ctx),
          ]);
          const context = { ...baseContext, applicationReference: input.referenceNumber };
          if (!isOperationsFlagEnabled("CUSTOMER_OPERATIONS_PORTAL", context, flags)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Customer portal unavailable" });
          }
          const bundle = await deps.load(input.referenceNumber);
          if (!bundle) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
          const portal = buildCustomerPortalFromRuntime({ bundle, context, flags, customerAuthorized });
          if (!portal) throw new TRPCError({ code: "FORBIDDEN", message: "Customer portal unavailable" });
          return portal;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Customer portal unavailable" });
        }
      }),
  });
}

let access: MysqlOperationsAccessProvider | undefined;
let reader: MysqlOperationsCaseReadProvider | undefined;
function accessProvider() { return access ??= new MysqlOperationsAccessProvider(defaultOperationsSqlClient()); }
function readProvider() { return reader ??= new MysqlOperationsCaseReadProvider(defaultOperationsSqlClient()); }

export const customerOperationsRouter = createCustomerOperationsRouter({
  flagContextForContext: (ctx) => accessProvider().flagContextForContext(ctx),
  flagsForContext: () => accessProvider().featureFlags(),
  load: (reference) => readProvider().load(reference),
});
