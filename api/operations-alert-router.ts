import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import { MysqlOperationsAccessProvider, OperationsAccessError } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlSchedulerAlertProvider, SchedulerAlertPersistenceError,
  type SchedulerAlertTransitionCommand } from "./lib/travel/mysql-scheduler-alert-provider";
import type { SchedulerAlertEvent } from "./lib/travel/scheduler-runtime";
import { createRouter, staffOrAdminQuery } from "./middleware";

const applicationInput = z.object({ applicationId: z.number().int().positive() }).strict();
const alertInput = applicationInput.extend({ alertId: z.string().uuid() }).strict();
const transitionInput = alertInput.extend({
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(100),
  correlationId: z.string().trim().min(8).max(100),
  reason: z.string().trim().min(3).max(500),
}).strict();

export type SchedulerAlertService = {
  listForApplication(applicationId: number, actor: AuthorizationActor): Promise<readonly SchedulerAlertEvent[]>;
  get(applicationId: number, alertId: string, actor: AuthorizationActor): Promise<SchedulerAlertEvent>;
  acknowledge(input: SchedulerAlertTransitionCommand, actor: AuthorizationActor): Promise<SchedulerAlertEvent>;
  resolve(input: SchedulerAlertTransitionCommand, actor: AuthorizationActor): Promise<SchedulerAlertEvent>;
};

type Dependencies = {
  actorForContext(ctx: TrpcContext): Promise<AuthorizationActor>;
  service: SchedulerAlertService;
};

function safeError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  if (error instanceof OperationsAccessError) throw new TRPCError({ code: "FORBIDDEN", message: "Operations access denied" });
  if (!(error instanceof SchedulerAlertPersistenceError)) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Scheduler alert unavailable" });
  }
  if (["FEATURE_DISABLED", "FORBIDDEN"].includes(error.code)) throw new TRPCError({ code: "FORBIDDEN", message: "Operations access denied" });
  if (error.code === "NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "Scheduler alert not found" });
  if (["CONCURRENCY_CONFLICT", "IDEMPOTENCY_CONFLICT"].includes(error.code)) {
    throw new TRPCError({ code: "CONFLICT", message: error.code });
  }
  if (error.code === "INVALID_TRANSITION") throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.code });
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Scheduler alert unavailable" });
}

export function createOperationsAlertRouter(deps: Dependencies) {
  const actor = async (ctx: TrpcContext): Promise<AuthorizationActor> => {
    // An admin cookie cannot substitute for scoped Operations staff RBAC.
    if (!ctx.staffId) throw new TRPCError({ code: "FORBIDDEN", message: "Operations access denied" });
    try { return await deps.actorForContext(ctx); } catch (error) { safeError(error); }
  };
  return createRouter({
    list: staffOrAdminQuery.input(applicationInput).query(async ({ input, ctx }) => {
      try { return await deps.service.listForApplication(input.applicationId, await actor(ctx)); } catch (error) { safeError(error); }
    }),
    get: staffOrAdminQuery.input(alertInput).query(async ({ input, ctx }) => {
      try { return await deps.service.get(input.applicationId, input.alertId, await actor(ctx)); } catch (error) { safeError(error); }
    }),
    acknowledge: staffOrAdminQuery.input(transitionInput).mutation(async ({ input, ctx }) => {
      try { return await deps.service.acknowledge(input, await actor(ctx)); } catch (error) { safeError(error); }
    }),
    resolve: staffOrAdminQuery.input(transitionInput).mutation(async ({ input, ctx }) => {
      try { return await deps.service.resolve(input, await actor(ctx)); } catch (error) { safeError(error); }
    }),
  });
}

let access: MysqlOperationsAccessProvider | undefined;
let alerts: MysqlSchedulerAlertProvider | undefined;
function accessProvider(): MysqlOperationsAccessProvider {
  return access ??= new MysqlOperationsAccessProvider(defaultOperationsSqlClient());
}
function alertProvider(): MysqlSchedulerAlertProvider {
  return alerts ??= new MysqlSchedulerAlertProvider(defaultOperationsPool(), accessProvider());
}

export const operationsAlertRouter = createOperationsAlertRouter({
  actorForContext: (ctx) => accessProvider().actorForContext(ctx),
  service: {
    listForApplication: (applicationId, actor) => alertProvider().listForApplication(applicationId, actor),
    get: (applicationId, alertId, actor) => alertProvider().get(applicationId, alertId, actor),
    acknowledge: (input, actor) => alertProvider().acknowledge(input, actor),
    resolve: (input, actor) => alertProvider().resolve(input, actor),
  },
});
