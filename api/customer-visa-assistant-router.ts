import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { TrpcContext } from "./context";
import { assertApplicationReferenceAccess } from "./lib/application-authorization";
import {
  requestCustomerCaseHandoff,
  type CaseHandoffRepository,
} from "./lib/customer/case-handoff-runtime";
import { answerCustomerVisaAssistant } from "./lib/customer/visa-assistant-runtime";
import type {
  FeatureFlagContext,
  FeatureFlagRecord,
} from "./lib/feature-flags/feature-flags";
import { MysqlOperationsAccessProvider } from "./lib/operations/mysql-access-provider";
import { MysqlCaseHandoffRepository } from "./lib/operations/mysql-case-handoff-repository";
import {
  MysqlOperationsCaseReadProvider,
  type MysqlOperationsCaseBundle,
} from "./lib/operations/mysql-case-read-provider";
import {
  defaultOperationsPool,
  defaultOperationsSqlClient,
} from "./lib/operations/mysql-query-client";
import { applicationAccessQuery, createRouter } from "./middleware";

type Dependencies = {
  flagContext(
    ctx: TrpcContext
  ): FeatureFlagContext | Promise<FeatureFlagContext>;
  flags(): Promise<readonly FeatureFlagRecord[]>;
  load(reference: string): Promise<MysqlOperationsCaseBundle | null>;
  handoffs: CaseHandoffRepository;
  now(): Date;
};

export function createCustomerVisaAssistantRouter(deps: Dependencies) {
  const owned = async (ctx: TrpcContext, reference: string) => {
    assertApplicationReferenceAccess(ctx, reference);
    if (!ctx.customerApplicationReferences.has(reference))
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Visa Assistant access denied",
      });
    const [base, flags, bundle] = await Promise.all([
      deps.flagContext(ctx),
      deps.flags(),
      deps.load(reference),
    ]);
    if (!bundle)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Application not found",
      });
    return { base, flags, bundle };
  };
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
        try {
          const { base, flags, bundle } = await owned(
            ctx,
            input.applicationReference
          );
          const answer = answerCustomerVisaAssistant({
            bundle,
            context: {
              ...base,
              applicationReference: input.applicationReference,
            },
            flags,
            ...input,
            customerAuthorized: true,
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
    requestHandoff: applicationAccessQuery
      .input(
        z
          .object({
            applicationReference: z.string().trim().min(3).max(50),
            questionKey: z.string().trim().min(2).max(100),
            requestId: z.string().uuid(),
          })
          .strict()
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const { base, flags, bundle } = await owned(
            ctx,
            input.applicationReference
          );
          const requestFingerprint = createHash("sha256")
            .update(
              JSON.stringify({
                applicationReference: input.applicationReference,
                questionKey: input.questionKey,
              })
            )
            .digest("hex");
          const handoff = await requestCustomerCaseHandoff({
            bundle,
            context: {
              ...base,
              applicationReference: input.applicationReference,
            },
            flags,
            applicationReference: input.applicationReference,
            customerAuthorized: true,
            questionKey: input.questionKey,
            requestId: input.requestId,
            requestFingerprint,
            now: deps.now(),
            repository: deps.handoffs,
          });
          if (!handoff)
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Case handoff unavailable",
            });
          return {
            handoffId: handoff.handoffId,
            state: handoff.state,
            createdAt: handoff.createdAt,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          if (
            error instanceof Error &&
            error.message === "CASE_HANDOFF_IDEMPOTENCY_CONFLICT"
          ) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Case handoff request changed; create a new request",
            });
          }
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Case handoff requires specialist review",
          });
        }
      }),
  });
}

const access = new MysqlOperationsAccessProvider(defaultOperationsSqlClient());
const reader = new MysqlOperationsCaseReadProvider(
  defaultOperationsSqlClient()
);
export const customerVisaAssistantRouter = createCustomerVisaAssistantRouter({
  flagContext: ctx => access.flagContextForContext(ctx),
  flags: () => access.featureFlags(),
  load: reference => reader.load(reference),
  handoffs: new MysqlCaseHandoffRepository(defaultOperationsPool()),
  now: () => new Date(),
});
