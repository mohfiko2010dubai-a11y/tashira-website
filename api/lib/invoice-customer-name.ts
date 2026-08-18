import { asc, eq } from "drizzle-orm";
import { applicants } from "@db/schema";
import { getDb } from "../queries/connection";

export type InvoiceApplicantIdentity = { applicantIndex: number; fullName: string };

export function canonicalInvoiceCustomerName(applicantIdentities: InvoiceApplicantIdentity[]) {
  const leadApplicant = [...applicantIdentities].sort((left, right) => left.applicantIndex - right.applicantIndex)[0];
  const fullName = leadApplicant?.fullName.replace(/\s+/g, " ").trim();
  if (!fullName) {
    console.error("[Invoice Data Quality] Canonical lead applicant name is unavailable");
    throw new Error("Canonical applicant name is unavailable for invoice generation");
  }
  return fullName;
}

export async function getCanonicalInvoiceCustomerName(applicationId: number) {
  const applicantIdentities = await getDb().select({
    applicantIndex: applicants.applicantIndex,
    fullName: applicants.fullName,
  })
    .from(applicants)
    .where(eq(applicants.applicationId, applicationId))
    .orderBy(asc(applicants.applicantIndex));
  return canonicalInvoiceCustomerName(applicantIdentities);
}
