import { ErrorMessages } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import { assertApplicationIntakeOpen } from "./lib/application-intake";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { consumeRateLimit } from "./lib/rate-limit";
import { enforceStaffApplicationScope } from "./lib/staff-application-scope";
import { publicError } from "./lib/public-error";
import { redactStaffFinancials } from './lib/staff-financial-redaction';

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const safe = publicError(error);
    return { message: safe.message, code: shape.code,
      data: { code: shape.data.code, httpStatus: shape.data.httpStatus, correlationId: safe.correlationId } };
  },
});

export const createRouter = t.router;
const scopedProcedure = t.procedure.use(async ({ ctx, path, getRawInput, type, next }) => {
  await enforceStaffApplicationScope(ctx, path, await getRawInput(), type === "mutation");
  const result = await next();
  if (result.ok && ctx.staffId && !ctx.isAdmin && ctx.user?.role !== 'admin') {
    return { ...result, data: redactStaffFinancials(result.data) };
  }
  return result;
});
export const publicQuery = scopedProcedure;

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

const requireApplicationAccess = t.middleware(async ({ ctx, next }) => {
  const privileged = Boolean(ctx.staffId || ctx.isAdmin || ctx.user?.role === "admin");
  if (!privileged && ctx.customerApplicationReferences.size === 0) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: ErrorMessages.unauthenticated });
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

export const authedQuery = scopedProcedure.use(requireAuth);
export const adminQuery = scopedProcedure.use(requireAdmin).use(rateLimit("admin", 120));
export const staffOrAdminQuery = scopedProcedure.use(requireStaffOrAdmin).use(rateLimit("staff", 120));
export const loginQuery = t.procedure.use(rateLimit("login", 10, 15 * 60_000));
export const chatQuery = t.procedure.use(rateLimit("chat", 30));
export const uploadQuery = t.procedure.use(rateLimit("upload", 10));
export const applicationUploadQuery = scopedProcedure
  .use(requireApplicationAccess)
  .use(rateLimit("upload", 10));
// A file upload and its metadata save are two requests for one file, not two uploads.
export const applicationDocumentMetadataQuery = scopedProcedure
  .use(requireApplicationAccess)
  .use(rateLimit("document-metadata", 10));
export const paymentQuery = scopedProcedure.use(rateLimit("payment", 10));
export const securityDepositQuery = t.procedure.use(rateLimit("security-deposit", 10, 5 * 60_000));
export const applicationSubmissionQuery = t.procedure.use(rateLimit("application", 30));
const requireIntakeOpen = t.middleware(async ({ next }) => {
  await assertApplicationIntakeOpen();
  return next();
});
export const newApplicationQuery = applicationSubmissionQuery.use(requireIntakeOpen);
export const newPaymentQuery = paymentQuery.use(requireIntakeOpen);
export const recoveryRequestQuery = t.procedure.use(rateLimit("recovery-request", 5, 15 * 60_000));
export const recoveryVerifyQuery = t.procedure.use(rateLimit("recovery-verify", 10, 15 * 60_000));
export const applicationAccessQuery = scopedProcedure.use(requireApplicationAccess).use(rateLimit("customer", 120));
