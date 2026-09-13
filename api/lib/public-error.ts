import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { sanitizeLog } from "../../contracts/safe-log";

export function publicError(error: TRPCError) {
  const correlationId = randomUUID();
  console.error(sanitizeLog({ event: "request_error", correlationId, code: error.code, category: error.cause?.name ?? error.name }));
  // A cause is an internal exception, not reviewed business-validation copy.
  const internal = error.code === "INTERNAL_SERVER_ERROR" || Boolean(error.cause)
    || /(?:\b(?:select|insert|update|delete)\b[\s\S]*\b(?:from|into|set|where)\b|failed query|\bparams:|\bat .+\(.*:\d+:\d+\))/i.test(error.message);
  return { correlationId, message: internal
    ? `We could not complete this request. Please try again or contact support with reference ${correlationId}.`
    : error.message };
}

export function internalFailure(cause: unknown) {
  const safe = publicError(new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause }));
  return { success: false as const, error: safe.message, correlationId: safe.correlationId };
}
