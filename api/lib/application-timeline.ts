import { randomUUID } from "crypto";
import { and, asc, count, eq } from "drizzle-orm";
import { applicationTimelineEvents } from "@db/schema";
import { getDb } from "../queries/connection";

export const TIMELINE_EVENT_NAMES = [
  "APPLICATION_CREATED", "APPLICANT_ADDED", "APPLICANT_UPDATED", "APPLICATION_SUBMITTED", "POLICY_ACCEPTED",
  "PASSPORT_UPLOADED", "PHOTO_UPLOADED", "SUPPORTING_DOCUMENT_UPLOADED", "DOCUMENT_UPLOADED",
  "DOCUMENT_REPLACED", "DOCUMENT_DELETED", "DOCUMENT_REPLACEMENT_REQUESTED", "DOCUMENTS_VALIDATED",
  "CHECKOUT_OPENED", "PAYMENT_ELEMENT_LOADED", "PAYMENT_STARTED", "PAYMENT_INTENT_CREATED",
  "THREE_DS_REQUIRED", "THREE_DS_COMPLETED", "PAYMENT_FAILED", "PAYMENT_RETRIED",
  "PAYMENT_CONFIRMED", "CHECKOUT_ABANDONED", "PAYMENT_PAGE_CLOSED",
  "WEBHOOK_RECEIVED", "WEBHOOK_VERIFIED", "INVOICE_GENERATED",
  "GOVERNMENT_PROCESSING", "ADDITIONAL_DOCUMENTS_REQUESTED", "VISA_APPROVED", "VISA_ISSUED",
  "APPLICATION_COMPLETED", "APPLICATION_CANCELLED", "APPLICATION_REJECTED",
  "EVIDENCE_PACKAGE_GENERATED", "EVIDENCE_PACKAGE_DOWNLOADED",
  "DISPUTE_NOTE_ADDED", "MANUAL_REVIEW_REQUESTED",
] as const;

export type TimelineEventName = typeof TIMELINE_EVENT_NAMES[number];
export type TimelineActorType = "CUSTOMER" | "STAFF" | "ADMIN" | "SYSTEM" | "STRIPE";

export async function recordTimelineEvent(input: {
  applicationId: number;
  eventName: TimelineEventName;
  eventSource: string;
  actorType: TimelineActorType;
  paymentId?: number;
  sessionReference?: string;
  actorReference?: string;
  sanitizedCategory?: string;
  attemptNumber?: number;
  resultingState?: string;
  policyVersion?: string;
  evidenceHash?: string;
  summary?: string;
}) {
  const id = randomUUID();
  await getDb().insert(applicationTimelineEvents).values({
    id,
    applicationId: input.applicationId,
    paymentId: input.paymentId,
    sessionReference: input.sessionReference?.slice(0, 100),
    eventName: input.eventName,
    eventSource: input.eventSource.slice(0, 40),
    actorType: input.actorType,
    actorReference: input.actorReference?.slice(0, 100),
    sanitizedCategory: input.sanitizedCategory?.slice(0, 80),
    attemptNumber: input.attemptNumber,
    resultingState: input.resultingState?.slice(0, 50),
    policyVersion: input.policyVersion?.slice(0, 50),
    evidenceHash: input.evidenceHash,
    summary: input.summary?.slice(0, 255),
  });
  return id;
}

export async function listTimelineEvents(applicationId: number) {
  return getDb().select().from(applicationTimelineEvents)
    .where(eq(applicationTimelineEvents.applicationId, applicationId))
    .orderBy(asc(applicationTimelineEvents.createdAt), asc(applicationTimelineEvents.id));
}

export async function nextPaymentAttempt(applicationId: number) {
  const [result] = await getDb().select({ value: count() }).from(applicationTimelineEvents)
    .where(and(
      eq(applicationTimelineEvents.applicationId, applicationId),
      eq(applicationTimelineEvents.eventName, "PAYMENT_STARTED"),
    ));
  return Number(result?.value || 0) + 1;
}

export async function hasTimelineEvent(applicationId: number, eventName: TimelineEventName) {
  const [result] = await getDb().select({ value: count() }).from(applicationTimelineEvents)
    .where(and(
      eq(applicationTimelineEvents.applicationId, applicationId),
      eq(applicationTimelineEvents.eventName, eventName),
    ));
  return Number(result?.value || 0) > 0;
}

export async function hasTimelineEventReference(
  applicationId: number,
  eventName: TimelineEventName,
  actorReference: string,
) {
  const [result] = await getDb().select({ value: count() }).from(applicationTimelineEvents)
    .where(and(
      eq(applicationTimelineEvents.applicationId, applicationId),
      eq(applicationTimelineEvents.eventName, eventName),
      eq(applicationTimelineEvents.actorReference, actorReference),
    ));
  return Number(result?.value || 0) > 0;
}

export { documentUploadEvent, sanitizePaymentFailureCategory } from "./timeline-safety";
