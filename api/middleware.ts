import { ErrorMessages } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { consumeRateLimit } from "./lib/rate-limit";

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

function rateLimit(scope: string, limit: number, windowMs = 60_000) {
  return t.middleware(async ({ ctx, next }) => {
    const result = consumeRateLimit(ctx.req.headers, scope, limit, windowMs);
    if (!result.allowed) {
      ctx.resHeaders.set("retry-after", String(result.retryAfterSeconds));
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests" });
    }
    return next({ ctx });
  });
}

export const authedQuery = t.procedure.use(requireAuth);
export const adminQuery = t.procedure.use(requireAdmin).use(rateLimit("admin", 120));
export const staffOrAdminQuery = t.procedure.use(requireStaffOrAdmin).use(rateLimit("staff", 120));
export const loginQuery = t.procedure.use(rateLimit("login", 10, 15 * 60_000));
export const chatQuery = t.procedure.use(rateLimit("chat", 30));
export const uploadQuery = t.procedure.use(rateLimit("upload", 10));
export const paymentQuery = t.procedure.use(rateLimit("payment", 10));
export const applicationSubmissionQuery = t.procedure.use(rateLimit("application", 30));
