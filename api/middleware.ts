import { ErrorMessages } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.isAdmin && ctx.user?.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: ErrorMessages.insufficientRole,
    });
  }

  return next({ ctx });
});

const requireStaffOrAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.staffId && !ctx.isAdmin && ctx.user?.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: ErrorMessages.insufficientRole,
    });
  }
  return next({ ctx });
});

export const authedQuery = t.procedure.use(requireAuth);
export const adminQuery = t.procedure.use(requireAdmin);
export const staffOrAdminQuery = t.procedure.use(requireStaffOrAdmin);
