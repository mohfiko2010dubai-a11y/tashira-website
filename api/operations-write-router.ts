import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { FeatureFlagContext, FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import { isOperationsFlagEnabled } from "./lib/feature-flags/feature-flags";
import { MysqlOperationsAccessProvider, OperationsAccessError } from "./lib/operations/mysql-access-provider";
import { MysqlControlledWriteExecutor, OperationsWriteError } from "./lib/operations/mysql-controlled-write-executor";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import type { ApplicationStatus, DocumentReviewOutcome, HumanReviewOutcome, WriteResult } from "./lib/operations/controlled-write-repository";
import { createRouter, staffOrAdminQuery } from "./middleware";

const HUMAN_OUTCOME = z.enum(["APPROVED_FOR_NEXT_STEP", "NEEDS_CORRECTION", "MANUAL_REVIEW_REQUIRED", "REJECTED_OPERATIONALLY"] satisfies readonly HumanReviewOutcome[]);
const DOCUMENT_OUTCOME = z.enum(["ACCEPTED", "REJECTED", "NEEDS_REPLACEMENT", "UNREADABLE", "MISMATCH", "MANUAL_REVIEW"] satisfies readonly DocumentReviewOutcome[]);
const STATUS = z.enum(["submitted", "payment_received", "documents_pending", "documents_received", "under_review", "visa_processing", "visa_received", "completed", "rejected", "cancelled"] satisfies readonly ApplicationStatus[]);
const COMMON = {
  applicationId: z.number().int().positive(), expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(8).max(100), reason: z.string().trim().min(3).max(500),
};
const humanReviewInput = z.object({ ...COMMON, outcome: HUMAN_OUTCOME }).strict();
const documentReviewInput = z.object({ ...COMMON, applicantId: z.number().int().positive(), documentId: z.number().int().positive(), expectedDocumentVersion: z.number().int().nonnegative(), outcome: DOCUMENT_OUTCOME }).strict();
const assignmentInput = z.object({ ...COMMON, mode: z.enum(["ASSIGN", "CLAIM", "REASSIGN"]), assigneeId: z.string().trim().min(1).max(100) }).strict();
const statusTransitionInput = z.object({ ...COMMON, to: STATUS }).strict();
const reevaluationInput = z.object({ ...COMMON, applicantId: z.number().int().positive(), expectedCurrentEvaluationId: z.string().trim().min(1).max(36) }).strict();

export type OperationsWriteExecutor = {
  humanReview(input: z.infer<typeof humanReviewInput>, actor: AuthorizationActor): Promise<WriteResult>;
  documentReview(input: z.infer<typeof documentReviewInput>, actor: AuthorizationActor): Promise<WriteResult>;
  assignment(input: z.infer<typeof assignmentInput>, actor: AuthorizationActor): Promise<WriteResult>;
  statusTransition(input: z.infer<typeof statusTransitionInput>, actor: AuthorizationActor): Promise<WriteResult>;
  requestReevaluation(input: z.infer<typeof reevaluationInput>, actor: AuthorizationActor): Promise<WriteResult>;
};

type Dependencies = {
  actorForContext(ctx: TrpcContext): Promise<AuthorizationActor>;
  flagContextForContext(ctx: TrpcContext): FeatureFlagContext | Promise<FeatureFlagContext>;
  flagsForContext(ctx: TrpcContext): Promise<readonly FeatureFlagRecord[]>;
  executor: OperationsWriteExecutor;
};

async function authorized(deps: Dependencies, ctx: TrpcContext): Promise<AuthorizationActor> {
  const flags = await deps.flagsForContext(ctx);
  if (!isOperationsFlagEnabled("OPERATIONS_CONTROLLED_WRITES", await deps.flagContextForContext(ctx), flags)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Operations controlled writes are disabled" });
  }
  try {
    return await deps.actorForContext(ctx);
  } catch (error) {
    if (error instanceof OperationsAccessError) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Operations access denied" });
    }
    throw error;
  }
}

export function createOperationsWriteRouter(deps: Dependencies) {
  const execute = async (work: () => Promise<WriteResult>): Promise<WriteResult> => {
    try {
      return await work();
    } catch (error) {
      if (!(error instanceof OperationsWriteError)) throw error;
      if (error.code === "UNAUTHENTICATED") throw new TRPCError({ code: "UNAUTHORIZED", message: error.code });
      if (["FORBIDDEN", "OUT_OF_SCOPE", "FEATURE_DISABLED"].includes(error.code)) throw new TRPCError({ code: "FORBIDDEN", message: error.code });
      if (error.code === "NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: error.code });
      if (["CONCURRENCY_CONFLICT", "IDEMPOTENCY_CONFLICT"].includes(error.code)) throw new TRPCError({ code: "CONFLICT", message: error.code });
      if (error.code === "PRECONDITION_FAILED") throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.code });
      if (error.code === "INVALID_STATE_TRANSITION") throw new TRPCError({ code: "BAD_REQUEST", message: error.code });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PERSISTENCE_FAILURE" });
    }
  };
  return createRouter({
    humanReview: staffOrAdminQuery.input(humanReviewInput).mutation(async ({ input, ctx }) => execute(async () => deps.executor.humanReview(input, await authorized(deps, ctx)))),
    documentReview: staffOrAdminQuery.input(documentReviewInput).mutation(async ({ input, ctx }) => execute(async () => deps.executor.documentReview(input, await authorized(deps, ctx)))),
    assignment: staffOrAdminQuery.input(assignmentInput).mutation(async ({ input, ctx }) => execute(async () => deps.executor.assignment(input, await authorized(deps, ctx)))),
    statusTransition: staffOrAdminQuery.input(statusTransitionInput).mutation(async ({ input, ctx }) => execute(async () => deps.executor.statusTransition(input, await authorized(deps, ctx)))),
    requestReevaluation: staffOrAdminQuery.input(reevaluationInput).mutation(async ({ input, ctx }) => execute(async () => deps.executor.requestReevaluation(input, await authorized(deps, ctx)))),
  });
}

let defaultAccessProvider: MysqlOperationsAccessProvider | undefined;
function accessProvider(): MysqlOperationsAccessProvider {
  defaultAccessProvider ??= new MysqlOperationsAccessProvider(defaultOperationsSqlClient());
  return defaultAccessProvider;
}
let persistentExecutor: MysqlControlledWriteExecutor | undefined;
function executor(): MysqlControlledWriteExecutor {
  persistentExecutor ??= new MysqlControlledWriteExecutor(defaultOperationsPool(), accessProvider());
  return persistentExecutor;
}
export const operationsWriteRouter = createOperationsWriteRouter({
  actorForContext: (ctx) => accessProvider().actorForContext(ctx),
  flagContextForContext: (ctx) => accessProvider().flagContextForContext(ctx),
  flagsForContext: () => accessProvider().featureFlags(),
  executor: {
    humanReview: (input, actor) => executor().humanReview(input, actor),
    documentReview: (input, actor) => executor().documentReview(input, actor),
    assignment: (input, actor) => executor().assignment(input, actor),
    statusTransition: (input, actor) => executor().statusTransition(input, actor),
    requestReevaluation: (input, actor) => executor().requestReevaluation(input, actor),
  },
});
