import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import { projectCanonicalStatus, type CanonicalStatusEvent } from "../operations/status-projection";
import type { SubmissionScheduleSnapshot } from "../travel/submission-scheduler";

export type CustomerPortalApplicant = {
  applicantId: number;
  label: string;
  requirementSummary: { complete: number; total: number; outstandingLabels: readonly string[] };
};

export type CustomerOperationsPortal = {
  applicationReference: string;
  currentStatus: { code: CanonicalStatusEvent["status"]; message: string; occurredAt: string };
  applicants: readonly CustomerPortalApplicant[];
  timeline: readonly { eventId: string; status: CanonicalStatusEvent["status"]; message: string; occurredAt: string }[];
  travel: readonly { travelGroupId: string; plannedArrivalDate: string; submissionState: SubmissionScheduleSnapshot["state"]; explanation: string }[];
  requiredCustomerActions: readonly string[];
};

const SCHEDULE_EXPLANATIONS: Readonly<Partial<Record<SubmissionScheduleSnapshot["state"], string>>> = {
  SCHEDULED_FOR_SUBMISSION: "Your completed application is scheduled for the recommended submission window.",
  TOO_EARLY: "Government submission will wait until the safe submission window.",
  BLOCKED_BY_REQUIREMENTS: "Complete the outstanding requirements to continue.",
  BLOCKED_BY_MANUAL_REVIEW: "A TASHIRA specialist is reviewing your application.",
  READY_FOR_SUBMISSION: "Your application is ready for the next submission stage.",
  ALREADY_SUBMITTED: "Your application has been submitted for government processing.",
};

function buildPortal(input: {
  applicationReference: string;
  customerAuthorized: boolean;
  applicants: readonly CustomerPortalApplicant[];
  statusEvents: readonly CanonicalStatusEvent[];
  schedules: readonly SubmissionScheduleSnapshot[];
}): CustomerOperationsPortal {
  if (!input.customerAuthorized) throw new Error("CUSTOMER_PORTAL_AUTHORIZATION_REQUIRED");
  if (!input.applicationReference.trim() || input.statusEvents.length === 0) throw new Error("CUSTOMER_PORTAL_EVIDENCE_REQUIRED");
  const applicantIds = input.applicants.map(({ applicantId }) => applicantId);
  if (new Set(applicantIds).size !== applicantIds.length) throw new Error("CUSTOMER_PORTAL_APPLICANT_SCOPE_INVALID");
  const timeline = [...input.statusEvents]
    .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt) || left.eventId.localeCompare(right.eventId))
    .map((event) => {
      const projection = projectCanonicalStatus(event);
      return { eventId: event.eventId, status: projection.portal.status, message: projection.portal.message, occurredAt: event.occurredAt };
    });
  const current = timeline[timeline.length - 1];
  const requiredCustomerActions = input.applicants.flatMap((applicant) =>
    applicant.requirementSummary.outstandingLabels.map((label) => `${applicant.label}: ${label}`));
  return {
    applicationReference: input.applicationReference,
    currentStatus: { code: current.status, message: current.message, occurredAt: current.occurredAt },
    applicants: input.applicants.map((applicant) => ({ ...applicant, requirementSummary: { ...applicant.requirementSummary, outstandingLabels: [...applicant.requirementSummary.outstandingLabels] } })),
    timeline,
    travel: input.schedules.map((schedule) => ({
      travelGroupId: schedule.travelGroupId,
      plannedArrivalDate: schedule.plannedArrivalDate,
      submissionState: schedule.state,
      explanation: SCHEDULE_EXPLANATIONS[schedule.state] ?? "Submission timing is being evaluated.",
    })),
    requiredCustomerActions,
  };
}

export function buildCustomerOperationsPortalBehindFlag(input: {
  context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  applicationReference: string;
  customerAuthorized: boolean;
  applicants: readonly CustomerPortalApplicant[];
  statusEvents: readonly CanonicalStatusEvent[];
  schedules: readonly SubmissionScheduleSnapshot[];
}): CustomerOperationsPortal | null {
  if (!isOperationsFlagEnabled("CUSTOMER_OPERATIONS_PORTAL", input.context, input.flags)) return null;
  return buildPortal(input);
}
