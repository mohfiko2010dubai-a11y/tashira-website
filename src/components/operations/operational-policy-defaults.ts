import type { SubmissionPolicyThresholds } from "../../../api/lib/travel/operational-submission-policy";

export const OWNER_POLICY_V1_THRESHOLDS: SubmissionPolicyThresholds = { scheduledAfterDays: 45, recommendedMinDays: 21, recommendedMaxDays: 45,
  readyMinDays: 8, readyMaxDays: 20, urgentMinDays: 4, urgentMaxDays: 7, humanReviewMinDays: 0, humanReviewMaxDays: 3,
  dueSoonDays: 14, alertUrgentDays: 7, dueTodayDays: 0 };
