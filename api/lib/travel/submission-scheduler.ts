import { createHash } from "node:crypto";
import type { OperationalSubmissionPolicy } from "./operational-submission-policy";

export type SubmissionScheduleState =
  | "NOT_EVALUATED"
  | "NOT_APPLICABLE"
  | "TOO_EARLY"
  | "SCHEDULED_FOR_SUBMISSION"
  | "RECOMMENDED_WINDOW"
  | "URGENT"
  | "SUBMISSION_WINDOW_OPEN"
  | "READY_FOR_SUBMISSION"
  | "BLOCKED_BY_REQUIREMENTS"
  | "BLOCKED_BY_MANUAL_REVIEW"
  | "OVERDUE"
  | "ALREADY_SUBMITTED"
  | "HUMAN_REVIEW_REQUIRED";

export type SubmissionTimingRule = {
  ruleId: string;
  version: number;
  classification: "OFFICIAL";
  entryValidityDays: number;
};

export type SubmissionScheduleSnapshot = {
  evaluationId: string;
  evaluatedAt: string;
  travelGroupId: string;
  routeCode: string;
  plannedArrivalDate: string;
  earliestSafeSubmissionDate: string | null;
  targetSubmissionDate: string | null;
  latestSafeSubmissionDate: string | null;
  state: SubmissionScheduleState;
  reason: string;
  blockingReasons: readonly string[];
  recalculationReason: string;
  ruleVersions: readonly { ruleId: string; version: number; classification: "OFFICIAL" | "OPERATIONAL" }[];
  sourceEvidenceReferences: readonly string[];
  evidenceSha256: string;
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shift(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

export function evaluateSubmissionSchedule(input: {
  evaluationId: string;
  evaluatedAt: Date;
  travelGroupId: string;
  routeCode: string;
  plannedArrivalDate: string;
  officialRule: SubmissionTimingRule | null;
  operationalPolicy: OperationalSubmissionPolicy | null;
  readinessSatisfied: boolean;
  applicable?: boolean;
  alreadySubmitted?: boolean;
  manualReviewRequired?: boolean;
  hardBlockBeforeWindow?: boolean;
  blockingReasons?: readonly string[];
  recalculationReason?: string;
  sourceEvidenceReferences?: readonly string[];
}): SubmissionScheduleSnapshot {
  const blockingReasons = [...new Set(input.blockingReasons ?? [])].sort();
  let state: SubmissionScheduleState;
  let reason: string;
  let earliest: string | null = null;
  let target: string | null = null;
  let latest: string | null = null;
  if (input.alreadySubmitted === true) {
    state = "ALREADY_SUBMITTED";
    reason = "GOVERNMENT_SUBMISSION_ALREADY_RECORDED";
  } else if (input.applicable === false) {
    state = "NOT_APPLICABLE";
    reason = "SUBMISSION_SCHEDULER_NOT_APPLICABLE_TO_ROUTE";
  } else if (!input.officialRule || input.officialRule.classification !== "OFFICIAL") {
    state = "HUMAN_REVIEW_REQUIRED";
    reason = "OFFICIAL_ENTRY_VALIDITY_RULE_UNRESOLVED";
  } else if (!input.operationalPolicy || input.operationalPolicy.classification !== "OPERATIONAL" || input.operationalPolicy.state !== "ACTIVE") {
    state = "HUMAN_REVIEW_REQUIRED";
    reason = "OPERATIONAL_SUBMISSION_POLICY_UNRESOLVED";
  } else {
    const policy = input.operationalPolicy.thresholds;
    earliest = shift(input.plannedArrivalDate, -policy.scheduledAfterDays);
    target = shift(input.plannedArrivalDate, -policy.dueSoonDays);
    latest = input.plannedArrivalDate;
    const today = dateOnly(input.evaluatedAt);
    const daysUntilArrival = Math.ceil((new Date(`${input.plannedArrivalDate}T00:00:00.000Z`).getTime()
      - new Date(`${today}T00:00:00.000Z`).getTime()) / 86_400_000);
    if (input.manualReviewRequired === true) {
      state = "BLOCKED_BY_MANUAL_REVIEW";
      reason = blockingReasons[0] ?? "MANUAL_REVIEW_REQUIRED";
    } else if (!input.readinessSatisfied || blockingReasons.length > 0) {
      state = "BLOCKED_BY_REQUIREMENTS";
      reason = blockingReasons[0] ?? "READINESS_PREREQUISITES_NOT_SATISFIED";
    } else if (daysUntilArrival > policy.scheduledAfterDays) {
      state = "SCHEDULED_FOR_SUBMISSION";
      reason = "FUTURE_TRAVEL_SCHEDULED_OPERATIONALLY";
    } else if (daysUntilArrival >= policy.recommendedMinDays && daysUntilArrival <= policy.recommendedMaxDays) {
      state = "RECOMMENDED_WINDOW";
      reason = "RECOMMENDED_SUBMISSION_WINDOW";
    } else if (daysUntilArrival >= policy.readyMinDays && daysUntilArrival <= policy.readyMaxDays) {
      state = "READY_FOR_SUBMISSION";
      reason = "READY_SUBMISSION_WINDOW";
    } else if (daysUntilArrival >= policy.urgentMinDays && daysUntilArrival <= policy.urgentMaxDays) {
      state = "URGENT";
      reason = "URGENT_SUBMISSION_WINDOW";
    } else if (daysUntilArrival >= policy.humanReviewMinDays && daysUntilArrival <= policy.humanReviewMaxDays) {
      state = "HUMAN_REVIEW_REQUIRED";
      reason = "IMMINENT_TRAVEL_REQUIRES_HUMAN_REVIEW";
    } else {
      state = "OVERDUE";
      reason = "PLANNED_TRAVEL_DATE_PASSED";
    }
  }
  const ruleVersions = [input.officialRule ? { ruleId: input.officialRule.ruleId, version: input.officialRule.version, classification: "OFFICIAL" as const } : null,
    input.operationalPolicy ? { ruleId: input.operationalPolicy.policyId, version: input.operationalPolicy.version, classification: "OPERATIONAL" as const } : null]
    .filter((rule): rule is { ruleId: string; version: number; classification: "OFFICIAL" | "OPERATIONAL" } => rule !== null)
    .sort((a, b) => a.classification.localeCompare(b.classification) || a.ruleId.localeCompare(b.ruleId));
  const recalculationReason = input.recalculationReason ?? "INITIAL_EVALUATION";
  const sourceEvidenceReferences = [...new Set(input.sourceEvidenceReferences ?? [])].sort();
  const evidence = { evaluationId: input.evaluationId, evaluatedAt: input.evaluatedAt.toISOString(), travelGroupId: input.travelGroupId,
    routeCode: input.routeCode, plannedArrivalDate: input.plannedArrivalDate, earliest, target, latest, state, reason,
    blockingReasons, recalculationReason, ruleVersions, sourceEvidenceReferences };
  return { ...evidence, earliestSafeSubmissionDate: earliest, targetSubmissionDate: target,
    latestSafeSubmissionDate: latest, evidenceSha256: createHash("sha256").update(JSON.stringify(evidence)).digest("hex") };
}
