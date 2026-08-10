import { TRPCError } from "@trpc/server";
import { applicants, applications } from "@db/schema";
import { and, eq } from "drizzle-orm";
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

export async function assertApplicantBelongsToApplication(applicantId: number | undefined, applicationId: number) {
  if (applicantId === undefined) return;
  const [applicant] = await getDb().select({ id: applicants.id }).from(applicants)
    .where(and(eq(applicants.id, applicantId), eq(applicants.applicationId, applicationId)))
    .limit(1);
  if (!applicant) throw new TRPCError({ code: "BAD_REQUEST", message: "Applicant does not belong to application" });
}
