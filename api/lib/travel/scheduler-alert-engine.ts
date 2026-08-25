import type { SubmissionQueueItem } from "../operations/submission-queue";
import type { SchedulerAlertSeverity, SchedulerAlertType } from "./scheduler-runtime";

export type SchedulerAlertCondition = {
  applicationId: number;
  applicantId: null;
  travelGroupId: string;
  scheduleEvaluationId: string;
  type: SchedulerAlertType;
  severity: SchedulerAlertSeverity;
  category: SubmissionQueueItem["category"];
  reason: string;
  context: Readonly<Record<string, string | number | boolean | null>>;
};

/** Pure deterministic policy. FUTURE produces no alert; lifecycle persistence remains provider-owned. */
export function schedulerAlertCondition(item: SubmissionQueueItem): SchedulerAlertCondition | null {
  if (item.category === "FUTURE") return null;
  const policy = {
    DUE_SOON: { type: "DUE_SOON", severity: "WARNING", reason: "SUBMISSION_DUE_SOON" },
    URGENT: { type: "URGENT", severity: "HIGH", reason: "SUBMISSION_URGENT" },
    DUE_TODAY: { type: "WINDOW_OPEN", severity: "HIGH", reason: "SUBMISSION_DUE_TODAY" },
    OVERDUE: { type: "OVERDUE", severity: "CRITICAL", reason: "SUBMISSION_OVERDUE" },
    BLOCKED: { type: "BLOCKED", severity: "WARNING", reason: "SUBMISSION_BLOCKED" },
  } as const;
  const selected = policy[item.category];
  return { applicationId: item.applicationId, applicantId: null, travelGroupId: item.travelGroupId,
    scheduleEvaluationId: item.scheduleEvaluationId, category: item.category, ...selected,
    context: { applicationReference: item.applicationReference, travelGroupReference: item.travelGroupReference,
      plannedArrivalDate: item.plannedArrivalDate, targetSubmissionDate: item.targetSubmissionDate,
      latestSafeSubmissionDate: item.latestSafeSubmissionDate, countdownDays: item.countdownDays,
      blockingReason: item.blockingReasons[0] ?? null } };
}
