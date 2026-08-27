import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { FeatureFlagContext, FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import { MysqlOperationsAccessProvider, OperationsAccessError } from "./lib/operations/mysql-access-provider";
import { MysqlOperationsCaseReadProvider, type MysqlOperationsCaseBundle } from "./lib/operations/mysql-case-read-provider";
import { readOperationsCase } from "./lib/operations/case-read-service";
import { defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlSubmissionQueueProvider } from "./lib/operations/mysql-submission-queue-provider";
import { buildUpcomingSubmissionsQueue, type SubmissionQueueCandidate, type SubmissionQueuePolicy } from "./lib/operations/submission-queue";
import { readOperationsManagerDashboard, type OperationsAnalyticsCandidate } from "./lib/operations/manager-dashboard-service";
import { MysqlOperationsManagerAnalyticsProvider } from "./lib/operations/mysql-manager-analytics-provider";
import { createRouter, staffOrAdminQuery } from "./middleware";
import { MysqlOperationalSubmissionPolicyProvider } from "./lib/travel/mysql-operational-submission-policy-provider";

type Dependencies = {
  actorForContext(ctx: TrpcContext): Promise<AuthorizationActor>;
  flagContextForContext(ctx: TrpcContext): FeatureFlagContext | Promise<FeatureFlagContext>;
  flagsForContext(ctx: TrpcContext): Promise<readonly FeatureFlagRecord[]>;
  load(reference: string): Promise<MysqlOperationsCaseBundle | null>;
  loadUpcoming?(): Promise<SubmissionQueueCandidate[]>;
  submissionQueuePolicy?(): SubmissionQueuePolicy | Promise<SubmissionQueuePolicy>;
  loadManagerAnalytics?(): Promise<OperationsAnalyticsCandidate[]>;
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
    upcomingSubmissions: staffOrAdminQuery
      .input(z.object({}).strict())
      .query(async ({ ctx }) => {
        if (!ctx.staffId) throw new TRPCError({ code: "FORBIDDEN", message: "Operations access denied" });
        if (!deps.loadUpcoming || !deps.submissionQueuePolicy) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Submission queue unavailable" });
        try {
          const [actor, context, flags, candidates] = await Promise.all([
            deps.actorForContext(ctx), deps.flagContextForContext(ctx), deps.flagsForContext(ctx), deps.loadUpcoming(),
          ]);
          return buildUpcomingSubmissionsQueue({ actor, context, flags, candidates, policy: await deps.submissionQueuePolicy(), now: new Date() });
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          if (error instanceof OperationsAccessError || error instanceof Error && error.message === "SUBMISSION_QUEUE_DISABLED") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Operations access denied" });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Submission queue unavailable" });
        }
      }),
    managerDashboard: staffOrAdminQuery.input(z.object({}).strict()).query(async ({ ctx }) => {
      if (!ctx.staffId) throw new TRPCError({ code: "FORBIDDEN", message: "Operations access denied" });
      if (!deps.loadManagerAnalytics || !deps.submissionQueuePolicy) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Operations dashboard unavailable" });
      try {
        const [actor, context, flags, candidates] = await Promise.all([
          deps.actorForContext(ctx), deps.flagContextForContext(ctx), deps.flagsForContext(ctx), deps.loadManagerAnalytics(),
        ]);
        const policy = await deps.submissionQueuePolicy();
        return readOperationsManagerDashboard({ actor, context, flags, candidates, now: new Date(), ...policy });
      } catch (error) {
        if (error instanceof OperationsAccessError || error instanceof Error
          && ["OPERATIONS_MANAGER_DASHBOARD_DISABLED", "OPERATIONS_MANAGER_DASHBOARD_ACCESS_DENIED"].includes(error.message)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Operations access denied" });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Operations dashboard unavailable" });
      }
    }),
  });
}

let access: MysqlOperationsAccessProvider | undefined;
let reader: MysqlOperationsCaseReadProvider | undefined;
let submissionQueue: MysqlSubmissionQueueProvider | undefined;
let managerAnalytics: MysqlOperationsManagerAnalyticsProvider | undefined;
let operationalPolicy: MysqlOperationalSubmissionPolicyProvider | undefined;
function accessProvider() { return access ??= new MysqlOperationsAccessProvider(defaultOperationsSqlClient()); }
function readProvider() { return reader ??= new MysqlOperationsCaseReadProvider(defaultOperationsSqlClient()); }
function queueProvider() { return submissionQueue ??= new MysqlSubmissionQueueProvider(defaultOperationsSqlClient()); }
function managerAnalyticsProvider() { return managerAnalytics ??= new MysqlOperationsManagerAnalyticsProvider(defaultOperationsSqlClient()); }
function operationalPolicyProvider() { return operationalPolicy ??= new MysqlOperationalSubmissionPolicyProvider(defaultOperationsSqlClient()); }
async function queuePolicy(): Promise<SubmissionQueuePolicy> {
  const policy = await operationalPolicyProvider().active(new Date());
  return { dueSoonDays: policy.thresholds.dueSoonDays, urgentDays: policy.thresholds.alertUrgentDays };
}

export const operationsReadRouter = createOperationsReadRouter({
  actorForContext: (ctx) => accessProvider().actorForContext(ctx),
  flagContextForContext: (ctx) => accessProvider().flagContextForContext(ctx),
  flagsForContext: () => accessProvider().featureFlags(),
  load: (reference) => readProvider().load(reference),
  loadUpcoming: () => queueProvider().list(),
  submissionQueuePolicy: queuePolicy,
  loadManagerAnalytics: () => managerAnalyticsProvider().list(),
});
