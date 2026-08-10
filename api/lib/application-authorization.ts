import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "../context";

export function hasPrivilegedApplicationAccess(ctx: TrpcContext): boolean {
  return Boolean(ctx.staffId || ctx.isAdmin || ctx.user?.role === "admin");
}

export function assertApplicationReferenceAccess(ctx: TrpcContext, referenceNumber: string): void {
  if (hasPrivilegedApplicationAccess(ctx)) return;
  if (!ctx.customerApplicationReferences.has(referenceNumber)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Application access denied" });
  }
}
