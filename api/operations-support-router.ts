import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import { MysqlOperationsAccessProvider, OperationsAccessError } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlSupportInboxRepository } from "./lib/operations/mysql-support-inbox-repository";
import { executeSupportCommand, listSupportThreads, readSupportThread, type SupportInboxRepository } from "./lib/operations/support-inbox-service";
import { createRouter, staffOrAdminQuery } from "./middleware";

const action = z.enum(["CLAIM","ASSIGN","REASSIGN","START","WAIT_FOR_CUSTOMER","RESOLVE","ADD_INTERNAL_NOTE"]);
const command = z.object({ commandId: z.string().min(8).max(100), expectedVersion: z.number().int().nonnegative(), action,
  targetStaffId: z.number().int().positive().optional(), noteId: z.string().uuid().optional(), noteBody: z.string().trim().min(1).max(4000).optional() }).strict();
type Access = Pick<MysqlOperationsAccessProvider, "actorForContext" | "flagContextForContext" | "featureFlags">;
type Dependencies = { access: Access; repository: SupportInboxRepository; now(): Date };
async function gate(deps: Dependencies, ctx: TrpcContext) { if (!ctx.staffId) throw new TRPCError({ code: "FORBIDDEN", message: "Support access denied" });
  const [actor, context, flags] = await Promise.all([deps.access.actorForContext(ctx), deps.access.flagContextForContext(ctx), deps.access.featureFlags()]); return { actor, context, flags, repository: deps.repository }; }
function safe(error: unknown): never { if (error instanceof OperationsAccessError || error instanceof Error && ["SUPPORT_INBOX_DISABLED","SUPPORT_ACCESS_DENIED","SUPPORT_STAFF_ACTOR_REQUIRED"].includes(error.message))
  throw new TRPCError({ code: "FORBIDDEN", message: "Support access denied" });
  if (error instanceof Error && ["SUPPORT_THREAD_VERSION_CONFLICT","SUPPORT_COMMAND_IDEMPOTENCY_CONFLICT"].includes(error.message)) throw new TRPCError({ code: "CONFLICT", message: "Support thread changed; refresh and retry" });
  if (error instanceof Error && error.message === "SUPPORT_THREAD_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "Support thread not found" });
  throw new TRPCError({ code: "BAD_REQUEST", message: "Support action could not be completed" }); }

export function createOperationsSupportRouter(deps: Dependencies) { return createRouter({
  list: staffOrAdminQuery.input(z.object({}).strict()).query(async ({ ctx }) => { try { return await listSupportThreads(await gate(deps, ctx)); } catch (error) { safe(error); } }),
  detail: staffOrAdminQuery.input(z.object({ threadId: z.string().uuid() }).strict()).query(async ({ ctx, input }) => { try { return await readSupportThread({ ...await gate(deps, ctx), threadId: input.threadId }); } catch (error) { safe(error); } }),
  command: staffOrAdminQuery.input(z.object({ threadId: z.string().uuid(), command }).strict()).mutation(async ({ ctx, input }) => { try {
    return await executeSupportCommand({ ...await gate(deps, ctx), threadId: input.threadId, command: input.command, now: deps.now() });
  } catch (error) { safe(error); } }),
}); }

const access = new MysqlOperationsAccessProvider(defaultOperationsSqlClient());
export const operationsSupportRouter = createOperationsSupportRouter({ access, repository: new MysqlSupportInboxRepository(defaultOperationsPool()), now: () => new Date() });
