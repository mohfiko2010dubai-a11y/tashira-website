export type CanonicalOperationsStatus =
  | "APPLICATION_RECEIVED" | "DOCUMENTS_REQUIRED" | "DOCUMENTS_UNDER_REVIEW"
  | "ADDITIONAL_DOCUMENTS_REQUIRED" | "READY_FOR_SUBMISSION" | "GOVERNMENT_PROCESSING"
  | "VISA_APPROVED" | "VISA_ISSUED" | "COMPLETED" | "CANCELLED" | "REJECTED";

export type CanonicalStatusEvent = {
  eventId: string;
  applicationId: number;
  status: CanonicalOperationsStatus;
  occurredAt: string;
  actorType: "CUSTOMER" | "STAFF" | "ADMIN" | "SYSTEM";
  reasonCode: string;
  customerSafeDetail?: string;
};

export type StatusProjection = {
  eventId: string;
  applicationId: number;
  portal: { status: CanonicalOperationsStatus; message: string };
  email: { templateContext: CanonicalOperationsStatus; message: string };
  assistant: { status: CanonicalOperationsStatus; message: string };
  internalTimeline: { status: CanonicalOperationsStatus; reasonCode: string; actorType: CanonicalStatusEvent["actorType"] };
};

const CUSTOMER_MESSAGES: Readonly<Record<CanonicalOperationsStatus, string>> = {
  APPLICATION_RECEIVED: "Your application has been received.",
  DOCUMENTS_REQUIRED: "Documents are required to continue your application.",
  DOCUMENTS_UNDER_REVIEW: "Your documents are being reviewed.",
  ADDITIONAL_DOCUMENTS_REQUIRED: "Additional documents are required.",
  READY_FOR_SUBMISSION: "Your application is ready for the next submission stage.",
  GOVERNMENT_PROCESSING: "Your application is under government processing.",
  VISA_APPROVED: "Your visa application has been approved.",
  VISA_ISSUED: "Your visa has been issued.",
  COMPLETED: "Your application is complete.",
  CANCELLED: "Your application has been cancelled.",
  REJECTED: "Your application was not approved.",
};

export function projectCanonicalStatus(event: CanonicalStatusEvent): StatusProjection {
  if (!event.eventId.trim() || !Number.isSafeInteger(event.applicationId) || event.applicationId <= 0 || Number.isNaN(Date.parse(event.occurredAt))) {
    throw new Error("CANONICAL_STATUS_EVENT_INVALID");
  }
  const message = event.customerSafeDetail?.trim() || CUSTOMER_MESSAGES[event.status];
  return {
    eventId: event.eventId,
    applicationId: event.applicationId,
    portal: { status: event.status, message },
    email: { templateContext: event.status, message },
    assistant: { status: event.status, message },
    internalTimeline: { status: event.status, reasonCode: event.reasonCode, actorType: event.actorType },
  };
}
