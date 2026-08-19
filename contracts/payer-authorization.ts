export const PAYER_AUTHORIZATION_VERSION = "payer-authorization-2026-08-19-v1" as const;

export const THIRD_PARTY_PAYER_RELATIONSHIPS = [
  "Family Member",
  "Friend",
  "Employer",
  "Sponsor",
  "Other",
] as const;

export const PAYER_RELATIONSHIPS = ["Self", ...THIRD_PARTY_PAYER_RELATIONSHIPS] as const;

export type PayerRelationship = typeof PAYER_RELATIONSHIPS[number];
export type ThirdPartyPayerRelationship = typeof THIRD_PARTY_PAYER_RELATIONSHIPS[number];

export function normalizePersonName(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

export function isThirdPartyPayer(payerName: string, leadApplicantName: string) {
  return normalizePersonName(payerName).toLocaleLowerCase("en-US")
    !== normalizePersonName(leadApplicantName).toLocaleLowerCase("en-US");
}

export function payerRelationshipForCheckout(
  payerName: string,
  leadApplicantName: string,
  relationship: ThirdPartyPayerRelationship | "",
): PayerRelationship {
  if (!isThirdPartyPayer(payerName, leadApplicantName)) return "Self";
  if (!relationship) throw new Error("Select the payer's relationship to the applicant");
  return relationship;
}
