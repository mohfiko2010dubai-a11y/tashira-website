import { asc, eq } from "drizzle-orm";
import { applicants } from "@db/schema";
import { getDb } from "../queries/connection";
import { canonicalInvoiceCustomerIdentity } from "./invoice-customer-identity";

export async function getCanonicalInvoiceCustomerIdentity(applicationId: number) {
  const applicantIdentities = await getDb().select({
    applicantIndex: applicants.applicantIndex,
    fullName: applicants.fullName,
    nationality: applicants.nationality,
    passportNumber: applicants.passportNumber,
    passportExpiry: applicants.passportExpiry,
  })
    .from(applicants)
    .where(eq(applicants.applicationId, applicationId))
    .orderBy(asc(applicants.applicantIndex));
  return canonicalInvoiceCustomerIdentity(applicantIdentities);
}

export async function getCanonicalInvoiceCustomerName(applicationId: number) {
  return (await getCanonicalInvoiceCustomerIdentity(applicationId)).fullName;
}
