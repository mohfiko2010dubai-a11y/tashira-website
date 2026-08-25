import type { FeatureFlagContext, FeatureFlagRecord } from "../feature-flags/feature-flags";
import { buildOperationsCaseReadModel } from "../operations/case-read-model";
import type { MysqlOperationsCaseBundle } from "../operations/mysql-case-read-provider";
import type { CanonicalOperationsStatus, CanonicalStatusEvent } from "../operations/status-projection";
import { buildCustomerOperationsPortalBehindFlag, type CustomerOperationsPortal } from "./customer-operations-portal";

const STATUS_BY_EVENT: Readonly<Record<string, CanonicalOperationsStatus>> = {
  APPLICATION_CREATED: "APPLICATION_RECEIVED",
  APPLICATION_RECEIVED: "APPLICATION_RECEIVED",
  DOCUMENTS_REQUIRED: "DOCUMENTS_REQUIRED",
  MISSING_DOCUMENTS: "ADDITIONAL_DOCUMENTS_REQUIRED",
  ADDITIONAL_DOCUMENTS_REQUESTED: "ADDITIONAL_DOCUMENTS_REQUIRED",
  DOCUMENTS_UNDER_REVIEW: "DOCUMENTS_UNDER_REVIEW",
  DOCUMENTS_VALIDATED: "READY_FOR_SUBMISSION",
  APPLICATION_READY_FOR_SUBMISSION: "READY_FOR_SUBMISSION",
  APPLICATION_SUBMITTED: "GOVERNMENT_PROCESSING",
  SUBMITTED_TO_AUTHORITY: "GOVERNMENT_PROCESSING",
  GOVERNMENT_PROCESSING: "GOVERNMENT_PROCESSING",
  VISA_APPROVED: "VISA_APPROVED",
  VISA_ISSUED: "VISA_ISSUED",
  APPLICATION_COMPLETED: "COMPLETED",
  APPLICATION_CANCELLED: "CANCELLED",
  APPLICATION_REJECTED: "REJECTED",
};

const STATUS_BY_APPLICATION: Readonly<Record<string, CanonicalOperationsStatus>> = {
  submitted: "APPLICATION_RECEIVED",
  payment_received: "DOCUMENTS_UNDER_REVIEW",
  documents_pending: "DOCUMENTS_REQUIRED",
  documents_received: "DOCUMENTS_UNDER_REVIEW",
  under_review: "DOCUMENTS_UNDER_REVIEW",
  visa_processing: "GOVERNMENT_PROCESSING",
  visa_received: "VISA_ISSUED",
  completed: "COMPLETED",
  rejected: "REJECTED",
  cancelled: "CANCELLED",
};

function actorType(value: string): CanonicalStatusEvent["actorType"] {
  return value === "CUSTOMER" || value === "STAFF" || value === "ADMIN" ? value : "SYSTEM";
}

function statusEvents(bundle: MysqlOperationsCaseBundle): CanonicalStatusEvent[] {
  const applicationId = bundle.source.summary.applicationId;
  const events = bundle.source.operationalHistory.flatMap((event): CanonicalStatusEvent[] => {
    const status = STATUS_BY_EVENT[event.event.toUpperCase()];
    if (!status || Number.isNaN(Date.parse(event.occurredAt))) return [];
    return [{ eventId: event.id, applicationId, status, occurredAt: event.occurredAt,
      actorType: actorType(event.actorType), reasonCode: event.event }];
  });
  if (events.length > 0) return events;
  return [{
    eventId: `application-${applicationId}-current`, applicationId,
    status: STATUS_BY_APPLICATION[bundle.source.summary.status] ?? "APPLICATION_RECEIVED",
    occurredAt: bundle.source.summary.createdAt, actorType: "SYSTEM", reasonCode: "CURRENT_APPLICATION_STATE",
  }];
}

/** Customer-safe adapter over the finance-minimized canonical Operations case bundle. */
export function buildCustomerPortalFromRuntime(input: {
  bundle: MysqlOperationsCaseBundle;
  context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  customerAuthorized: boolean;
}): CustomerOperationsPortal | null {
  const model = buildOperationsCaseReadModel({
    ...input.bundle,
    supplierProjection: null,
  });
  return buildCustomerOperationsPortalBehindFlag({
    context: input.context,
    flags: input.flags,
    applicationReference: model.summary.reference,
    customerAuthorized: input.customerAuthorized,
    applicants: model.applicants.map((applicant) => {
      const outstanding = applicant.dynamicRequirements.filter(({ currentState }) =>
        currentState !== "VALIDATED" && currentState !== "WAIVED");
      return {
        applicantId: applicant.applicantId,
        label: applicant.displayName || `Applicant ${applicant.applicantIndex + 1}`,
        requirementSummary: {
          complete: applicant.dynamicRequirements.length - outstanding.length,
          total: applicant.dynamicRequirements.length,
          outstandingLabels: outstanding.map(({ instance }) => instance.code),
        },
      };
    }),
    statusEvents: statusEvents(input.bundle),
    schedules: model.travelGroups?.flatMap((group) => group.currentSchedule ? [group.currentSchedule] : []) ?? [],
  });
}
