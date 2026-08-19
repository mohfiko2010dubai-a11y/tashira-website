import { createHash } from "node:crypto";
import {
  PAYER_AUTHORIZATION_VERSION,
  PAYER_RELATIONSHIPS,
  isThirdPartyPayer,
  normalizePersonName,
  type PayerRelationship,
} from "@contracts/payer-authorization";

export type PayerEvidence = {
  payerName: string;
  relationship: PayerRelationship;
  acceptedAt: Date;
  evidenceVersion: string;
};

export function payerEvidenceFromTimelineEvent(event: {
  actorReference: string | null;
  sanitizedCategory: string | null;
  createdAt: Date;
  policyVersion: string | null;
} | undefined): PayerEvidence | null {
  if (!event?.actorReference || !PAYER_RELATIONSHIPS.includes(event.sanitizedCategory as PayerRelationship)) return null;
  return {
    payerName: event.actorReference,
    relationship: event.sanitizedCategory as PayerRelationship,
    acceptedAt: event.createdAt,
    evidenceVersion: event.policyVersion || PAYER_AUTHORIZATION_VERSION,
  };
}

export type PayerAuthorizationEvidenceInput = {
  payerName: string;
  payerRelationship: PayerRelationship;
  authorizationAccepted: boolean;
  authorizationVersion: typeof PAYER_AUTHORIZATION_VERSION;
  leadApplicantName: string;
};

export function validatePayerAuthorization(input: PayerAuthorizationEvidenceInput) {
  const payerName = normalizePersonName(input.payerName);
  const leadApplicantName = normalizePersonName(input.leadApplicantName);
  if (payerName.length < 2 || payerName.length > 100) throw new Error("Enter the cardholder's name as shown on the payment card");
  if (!leadApplicantName) throw new Error("Lead applicant identity is unavailable");
  if (!input.authorizationAccepted) throw new Error("Payment authorization must be accepted");
  if (input.authorizationVersion !== PAYER_AUTHORIZATION_VERSION) throw new Error("Payment authorization version is invalid");
  if (!PAYER_RELATIONSHIPS.includes(input.payerRelationship)) throw new Error("Payer relationship is invalid");
  const thirdParty = isThirdPartyPayer(payerName, leadApplicantName);
  if (thirdParty && input.payerRelationship === "Self") throw new Error("Select the payer's relationship to the applicant");
  return { payerName, leadApplicantName, payerRelationship: thirdParty ? input.payerRelationship : "Self" as const, thirdParty };
}

export function payerAuthorizationEventId(input: {
  applicationId: number;
  payerName: string;
  authorizationVersion: string;
}) {
  const digest = createHash("sha256")
    .update(`${input.applicationId}\n${normalizePersonName(input.payerName).toLocaleLowerCase("en-US")}\n${input.authorizationVersion}`)
    .digest("hex")
    .slice(0, 32);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20)}`;
}
