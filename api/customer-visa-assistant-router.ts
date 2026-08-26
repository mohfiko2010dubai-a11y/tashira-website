import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import { assertApplicationReferenceAccess } from "./lib/application-authorization";
import { answerCustomerVisaAssistant } from "./lib/customer/visa-assistant-runtime";
import type {
  FeatureFlagContext,
  FeatureFlagRecord,
} from "./lib/feature-flags/feature-flags";
import { MysqlOperationsAccessProvider } from "./lib/operations/mysql-access-provider";
import {
  MysqlOperationsCaseReadProvider,
  type MysqlOperationsCaseBundle,
} from "./lib/operations/mysql-case-read-provider";
import { defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { applicationAccessQuery, createRouter } from "./middleware";
type Dependencies = {
  flagContext(
    ctx: TrpcContext
  ): FeatureFlagContext | Promise<FeatureFlagContext>;
  flags(): Promise<readonly FeatureFlagRecord[]>;
  load(reference: string): Promise<MysqlOperationsCaseBundle | null>;
};
export function createCustomerVisaAssistantRouter(deps: Dependencies) {
  return createRouter({
    answer: applicationAccessQuery
      .input(
        z
          .object({
            applicationReference: z.string().trim().min(3).max(50),
            questionKey: z.string().trim().min(2).max(100),
          })
          .strict()
      )
      .query(async ({ ctx, input }) => {
        assertApplicationReferenceAccess(ctx, input.applicationReference);
        const customerAuthorized = ctx.customerApplicationReferences.has(
          input.applicationReference
        );
        if (!customerAuthorized)
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Visa Assistant access denied",
          });
        try {
          const [base, flags, bundle] = await Promise.all([
            deps.flagContext(ctx),
            deps.flags(),
            deps.load(input.applicationReference),
          ]);
          if (!bundle)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Application not found",
            });
          const answer = answerCustomerVisaAssistant({
            bundle,
            context: {
              ...base,
              applicationReference: input.applicationReference,
            },
            flags,
            ...input,
            customerAuthorized,
          });
          if (!answer)
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Visa Assistant unavailable",
            });
          return answer;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Visa Assistant requires human review",
          });
        }
      }),
  });
}
const access = new MysqlOperationsAccessProvider(defaultOperationsSqlClient()),
  reader = new MysqlOperationsCaseReadProvider(defaultOperationsSqlClient());
export const customerVisaAssistantRouter = createCustomerVisaAssistantRouter({
  flagContext: ctx => access.flagContextForContext(ctx),
  flags: () => access.featureFlags(),
  load: reference => reader.load(reference),
});
