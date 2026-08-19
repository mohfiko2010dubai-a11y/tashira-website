import { and, desc, eq } from "drizzle-orm";
import { applicationTimelineEvents } from "../../db/schema";
import { PAYER_AUTHORIZATION_VERSION, type PayerRelationship } from "@contracts/payer-authorization";
import { getDb } from "../queries/connection";
import { payerAuthorizationEventId, payerEvidenceFromTimelineEvent, validatePayerAuthorization } from "./payer-authorization-core";

export type PayerAuthorizationInput = {
  applicationId: number;
  paymentId: number;
  payerName: string;
  payerRelationship: PayerRelationship;
  authorizationAccepted: true;
  authorizationVersion: typeof PAYER_AUTHORIZATION_VERSION;
  leadApplicantName: string;
};

export async function getPayerEvidence(applicationId: number, paymentId: number) {
  const [event] = await getDb().select({
    actorReference: applicationTimelineEvents.actorReference,
    sanitizedCategory: applicationTimelineEvents.sanitizedCategory,
    createdAt: applicationTimelineEvents.createdAt,
    policyVersion: applicationTimelineEvents.policyVersion,
  }).from(applicationTimelineEvents).where(and(
    eq(applicationTimelineEvents.applicationId, applicationId),
    eq(applicationTimelineEvents.paymentId, paymentId),
    eq(applicationTimelineEvents.eventName, "PAYER_AUTHORIZATION_ACCEPTED"),
  )).orderBy(desc(applicationTimelineEvents.createdAt)).limit(1);
  return payerEvidenceFromTimelineEvent(event);
}

function mysqlErrorCode(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if ("code" in current && typeof current.code === "string") return current.code;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

export async function recordPayerAuthorization(input: PayerAuthorizationInput) {
  const validated = validatePayerAuthorization(input);
  const id = payerAuthorizationEventId({
    applicationId: input.applicationId,
    payerName: validated.payerName,
    authorizationVersion: input.authorizationVersion,
  });
  try {
    await getDb().insert(applicationTimelineEvents).values({
      id,
      applicationId: input.applicationId,
      paymentId: input.paymentId,
      eventName: "PAYER_AUTHORIZATION_ACCEPTED",
      eventSource: "PAYMENT_CHECKOUT",
      actorType: "CUSTOMER",
      actorReference: validated.payerName,
      sanitizedCategory: validated.payerRelationship,
      resultingState: validated.thirdParty ? "third_party" : "self",
      policyVersion: input.authorizationVersion,
      summary: `Payer authorized payment for lead applicant ${validated.leadApplicantName}`.slice(0, 255),
    });
    return { id, created: true as const, ...validated };
  } catch (error: unknown) {
    if (mysqlErrorCode(error) !== "ER_DUP_ENTRY") throw error;
    return { id, created: false as const, ...validated };
  }
}
