import { asc, eq } from "drizzle-orm";
import { applicants } from "@db/schema";
import { getDb } from "../queries/connection";

export async function getCanonicalInvoiceCustomerName(applicationId: number) {
  const [leadApplicant] = await getDb().select({ fullName: applicants.fullName })
    .from(applicants)
    .where(eq(applicants.applicationId, applicationId))
    .orderBy(asc(applicants.applicantIndex))
    .limit(1);
  const fullName = leadApplicant?.fullName.trim();
  if (!fullName) throw new Error("Canonical applicant name is unavailable for invoice generation");
  return fullName;
}
