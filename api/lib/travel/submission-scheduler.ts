import { createHash } from "node:crypto";

export type SubmissionScheduleState =
  | "NOT_EVALUATED"
  | "NOT_APPLICABLE"
  | "TOO_EARLY"
  | "SCHEDULED_FOR_SUBMISSION"
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
  classification: "OFFICIAL" | "OPERATIONAL";
  entryValidityDays: number | null;
  expectedProcessingDays: number;
  safetyBufferDays: number;
  preferredLeadDays: number;
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
  operationalRule: SubmissionTimingRule | null;
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
  } else if (!input.operationalRule || input.operationalRule.classification !== "OPERATIONAL") {
    state = "HUMAN_REVIEW_REQUIRED";
    reason = "OPERATIONAL_SUBMISSION_POLICY_UNRESOLVED";
  } else {
    earliest = shift(input.plannedArrivalDate, -input.operationalRule.preferredLeadDays);
    target = shift(input.plannedArrivalDate, -Math.max(
      input.operationalRule.expectedProcessingDays + input.operationalRule.safetyBufferDays,
      1,
    ));
    latest = shift(input.plannedArrivalDate, -Math.max(input.operationalRule.expectedProcessingDays, 1));
    const today = dateOnly(input.evaluatedAt);
    if (input.manualReviewRequired === true) {
      state = "BLOCKED_BY_MANUAL_REVIEW";
      reason = blockingReasons[0] ?? "MANUAL_REVIEW_REQUIRED";
    } else if (!input.readinessSatisfied || blockingReasons.length > 0) {
      state = "BLOCKED_BY_REQUIREMENTS";
      reason = blockingReasons[0] ?? "READINESS_PREREQUISITES_NOT_SATISFIED";
    } else if (today < earliest && input.hardBlockBeforeWindow === true) {
      state = "TOO_EARLY";
      reason = "APPLICATION_TOO_EARLY";
    } else if (today < earliest) {
      state = "SCHEDULED_FOR_SUBMISSION";
      reason = "SUBMISSION_WINDOW_NOT_OPEN";
    } else {
      state = today > latest ? "OVERDUE" : "READY_FOR_SUBMISSION";
      reason = today > latest ? "SUBMISSION_WINDOW_OVERDUE" : "SUBMISSION_WINDOW_OPEN";
    }
  }
  const ruleVersions = [input.officialRule, input.operationalRule].filter((rule): rule is SubmissionTimingRule => rule !== null)
    .map(({ ruleId, version, classification }) => ({ ruleId, version, classification }))
    .sort((a, b) => a.classification.localeCompare(b.classification) || a.ruleId.localeCompare(b.ruleId));
  const recalculationReason = input.recalculationReason ?? "INITIAL_EVALUATION";
  const sourceEvidenceReferences = [...new Set(input.sourceEvidenceReferences ?? [])].sort();
  const evidence = { evaluationId: input.evaluationId, evaluatedAt: input.evaluatedAt.toISOString(), travelGroupId: input.travelGroupId,
    routeCode: input.routeCode, plannedArrivalDate: input.plannedArrivalDate, earliest, target, latest, state, reason,
    blockingReasons, recalculationReason, ruleVersions, sourceEvidenceReferences };
  return { ...evidence, earliestSafeSubmissionDate: earliest, targetSubmissionDate: target,
    latestSafeSubmissionDate: latest, evidenceSha256: createHash("sha256").update(JSON.stringify(evidence)).digest("hex") };
}
