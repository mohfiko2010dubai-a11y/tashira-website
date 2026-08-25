import { authorize, type AuthorizationActor, type AuthorizationResource } from "../authorization/policy";
import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { SubmissionScheduleState } from "../travel/submission-scheduler";
import type { SchedulerAlertSeverity, SchedulerAlertState, SchedulerAlertType } from "../travel/scheduler-runtime";

export type SubmissionQueueCategory = "FUTURE" | "DUE_SOON" | "URGENT" | "DUE_TODAY" | "OVERDUE" | "BLOCKED";
export type SubmissionQueuePolicy = { dueSoonDays: number; urgentDays: number };
export type SubmissionQueueCandidate = AuthorizationResource & {
  applicationId: number; applicationReference: string; travelGroupId: string; travelGroupReference: string; scheduleEvaluationId: string;
  applicantNames: readonly string[]; routeCode: string; plannedArrivalDate: string;
  targetSubmissionDate: string | null; latestSafeSubmissionDate: string | null;
  schedulerState: SubmissionScheduleState; readinessState: string; blockingReasons: readonly string[];
  manualReviewRequired: boolean;
};
export type SubmissionQueueItem = SubmissionQueueCandidate & { category: SubmissionQueueCategory; countdownDays: number | null;
  currentAlert?: { id: string; type: SchedulerAlertType; severity: SchedulerAlertSeverity; state: SchedulerAlertState; version: number; reason: string } | null };

function daysBetween(now: Date, date: string): number {
  const target = new Date(`${date.slice(0, 10)}T00:00:00.000Z`).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((target - today) / 86_400_000);
}

export function buildUpcomingSubmissionsQueue(input: {
  actor: AuthorizationActor; context: FeatureFlagContext; flags: readonly FeatureFlagRecord[];
  candidates: readonly SubmissionQueueCandidate[]; policy: SubmissionQueuePolicy; now: Date;
}): SubmissionQueueItem[] {
  if (!isOperationsFlagEnabled("OPERATIONS_CASE_READ_MODEL", input.context, input.flags)
    || !isOperationsFlagEnabled("SUBMISSION_SCHEDULER", input.context, input.flags)) throw new Error("SUBMISSION_QUEUE_DISABLED");
  if (input.policy.urgentDays < 0 || input.policy.dueSoonDays <= input.policy.urgentDays) throw new Error("INVALID_SUBMISSION_QUEUE_POLICY");
  return input.candidates.flatMap((candidate) => {
    const permission = input.actor.permissions.has("case.read") ? "case.read" as const : "case.read_assigned" as const;
    if (!authorize(input.actor, permission, candidate).allowed) return [];
    const countdownDays = candidate.targetSubmissionDate ? daysBetween(input.now, candidate.targetSubmissionDate) : null;
    let category: SubmissionQueueCategory;
    if (candidate.blockingReasons.length > 0 || candidate.manualReviewRequired || candidate.schedulerState.startsWith("BLOCKED")) category = "BLOCKED";
    else if (countdownDays === null) category = "FUTURE";
    else if (countdownDays < 0) category = "OVERDUE";
    else if (countdownDays === 0) category = "DUE_TODAY";
    else if (countdownDays <= input.policy.urgentDays) category = "URGENT";
    else if (countdownDays <= input.policy.dueSoonDays) category = "DUE_SOON";
    else category = "FUTURE";
    return [{ ...candidate, category, countdownDays }];
  }).sort((a, b) => (a.countdownDays ?? Number.MAX_SAFE_INTEGER) - (b.countdownDays ?? Number.MAX_SAFE_INTEGER)
    || a.applicationReference.localeCompare(b.applicationReference));
}
