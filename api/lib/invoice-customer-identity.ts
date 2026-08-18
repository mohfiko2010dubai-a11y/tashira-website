export type InvoiceApplicantIdentity = {
  applicantIndex: number;
  fullName: string;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
};

export type CanonicalInvoiceCustomerIdentity = {
  fullName: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
};

function normalized(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

export function canonicalInvoiceCustomerIdentity(
  applicantIdentities: InvoiceApplicantIdentity[],
): CanonicalInvoiceCustomerIdentity {
  const leadApplicant = [...applicantIdentities].sort((left, right) => left.applicantIndex - right.applicantIndex)[0];
  const identity = {
    fullName: normalized(leadApplicant?.fullName),
    nationality: normalized(leadApplicant?.nationality),
    passportNumber: normalized(leadApplicant?.passportNumber),
    passportExpiry: normalized(leadApplicant?.passportExpiry),
  };
  if (!identity.fullName) {
    console.error("[Invoice Data Quality] Canonical lead applicant name is unavailable");
    throw new Error("Canonical applicant name is unavailable for invoice generation");
  }
  for (const [field, value] of Object.entries(identity)) {
    if (!value) console.error(`[Invoice Data Quality] Canonical lead applicant ${field} is unavailable`);
  }
  return identity;
}

export function canonicalInvoiceCustomerName(applicantIdentities: InvoiceApplicantIdentity[]) {
  return canonicalInvoiceCustomerIdentity(applicantIdentities).fullName;
}
