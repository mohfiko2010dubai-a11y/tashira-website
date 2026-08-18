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
