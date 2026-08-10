import { TRPCError } from "@trpc/server";
import { applications } from "@db/schema";
import { eq } from "drizzle-orm";
import type { TrpcContext } from "../context";
import { getDb } from "../queries/connection";

export function hasPrivilegedApplicationAccess(ctx: TrpcContext): boolean {
  return Boolean(ctx.staffId || ctx.isAdmin || ctx.user?.role === "admin");
}

export function assertApplicationReferenceAccess(ctx: TrpcContext, referenceNumber: string): void {
  if (hasPrivilegedApplicationAccess(ctx)) return;
  if (!ctx.customerApplicationReferences.has(referenceNumber)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Application access denied" });
  }
}

export async function assertApplicationIdAccess(ctx: TrpcContext, applicationId: number): Promise<string> {
  const [application] = await getDb().select({ referenceNumber: applications.referenceNumber })
    .from(applications)
    .where(eq(applications.id, applicationId))
    .limit(1);

  if (!application) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
  }
  assertApplicationReferenceAccess(ctx, application.referenceNumber);
  return application.referenceNumber;
}
