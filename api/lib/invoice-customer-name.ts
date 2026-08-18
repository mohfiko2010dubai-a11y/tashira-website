import { asc, eq } from "drizzle-orm";
import { applicants } from "@db/schema";
import { getDb } from "../queries/connection";
import { canonicalInvoiceCustomerName } from "./invoice-customer-identity";

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
