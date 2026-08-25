import type { SubmissionScheduleSnapshot } from "./submission-scheduler";

export type SchedulerAlertState = "CREATED" | "ACKNOWLEDGED" | "RESOLVED";
export type SchedulerAlertType = "WINDOW_OPEN" | "DUE_SOON" | "URGENT" | "OVERDUE" | "BLOCKED";
export type SchedulerAlertSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";
export type SchedulerQueueCategory = "FUTURE" | "DUE_SOON" | "URGENT" | "DUE_TODAY" | "OVERDUE" | "BLOCKED";

export type SchedulerAlertEvent = {
  id: string;
  alertKey: string;
  applicationId: number;
  applicantId: number | null;
  travelGroupId: string;
  scheduleEvaluationId: string;
  type: SchedulerAlertType;
  severity: SchedulerAlertSeverity;
  category: SchedulerQueueCategory;
  state: SchedulerAlertState;
  version: number;
  actorId: string;
  reason: string;
  context: Readonly<Record<string, string | number | boolean | null>>;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
};

export type SchedulerCustomerContract = {
  state: "SCHEDULED_FOR_SUBMISSION" | "APPLICATION_TOO_EARLY" | "READY_FOR_SUBMISSION" | "ACTION_REQUIRED" | "SUBMITTED";
  plannedTravelDate: string;
  recommendedSubmissionWindow: { earliest: string | null; latest: string | null };
  earliestEligibleDate: string | null;
  customerSafeExplanation: string;
  ruleClassification: "OFFICIAL" | "OPERATIONAL" | "MIXED" | "UNRESOLVED";
};

export type SchedulerCommunicationEvent =
  | "APPLICATION_SCHEDULED_FOR_SUBMISSION"
  | "TRAVEL_DATE_CHANGED"
  | "SUBMISSION_DELAYED_BY_MISSING_DOCUMENT"
  | "APPLICATION_READY_FOR_SUBMISSION"
  | "SUBMISSION_COMPLETED";

export function schedulerAlertKey(input: Pick<SchedulerAlertEvent, "applicationId" | "travelGroupId" | "scheduleEvaluationId" | "type">): string {
  return `${input.applicationId}:${input.travelGroupId}:${input.scheduleEvaluationId}:${input.type}`;
}

export function appendSchedulerAlertEvent(input: {
  history: readonly SchedulerAlertEvent[];
  eventId: string;
  applicationId: number;
  applicantId?: number | null;
  travelGroupId: string;
  scheduleEvaluationId: string;
  type: SchedulerAlertType;
  severity: SchedulerAlertSeverity;
  category: SchedulerQueueCategory;
  targetState: SchedulerAlertState;
  expectedVersion: number;
  actorId: string;
  reason: string;
  context?: Readonly<Record<string, string | number | boolean | null>>;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
}): { appended: boolean; event: SchedulerAlertEvent } {
  const alertKey = schedulerAlertKey(input);
  const history = input.history.filter((event) => event.alertKey === alertKey).sort((a, b) => a.version - b.version);
  const current = history.at(-1);
  if (current?.state === input.targetState) return { appended: false, event: current };
  const currentVersion = current?.version ?? 0;
  if (currentVersion !== input.expectedVersion) throw new Error("SCHEDULER_ALERT_VERSION_CONFLICT");
  const allowed = current === undefined ? input.targetState === "CREATED"
    : current.state === "CREATED" ? input.targetState === "ACKNOWLEDGED" || input.targetState === "RESOLVED"
      : current.state === "ACKNOWLEDGED" && input.targetState === "RESOLVED";
  if (!allowed) throw new Error("INVALID_SCHEDULER_ALERT_TRANSITION");
  if (!input.actorId.trim() || !input.reason.trim()) throw new Error("SCHEDULER_ALERT_EVIDENCE_REQUIRED");
  return { appended: true, event: { id: input.eventId, alertKey, applicationId: input.applicationId, applicantId: input.applicantId ?? null,
    travelGroupId: input.travelGroupId, scheduleEvaluationId: input.scheduleEvaluationId, type: input.type, severity: input.severity, category: input.category,
    state: input.targetState, version: currentVersion + 1, actorId: input.actorId, reason: input.reason,
    context: input.context ?? {}, correlationId: input.correlationId, idempotencyKey: input.idempotencyKey, occurredAt: input.occurredAt } };
}

export function toSchedulerCustomerContract(snapshot: SubmissionScheduleSnapshot): SchedulerCustomerContract {
  const classifications = new Set(snapshot.ruleVersions.map((rule) => rule.classification));
  const ruleClassification = classifications.size === 0 ? "UNRESOLVED" : classifications.size > 1 ? "MIXED"
    : classifications.has("OFFICIAL") ? "OFFICIAL" : "OPERATIONAL";
  const common = { plannedTravelDate: snapshot.plannedArrivalDate,
    recommendedSubmissionWindow: { earliest: snapshot.earliestSafeSubmissionDate, latest: snapshot.latestSafeSubmissionDate },
    earliestEligibleDate: snapshot.earliestSafeSubmissionDate, ruleClassification } as const;
  if (snapshot.state === "TOO_EARLY") return { ...common, state: "APPLICATION_TOO_EARLY",
    customerSafeExplanation: "This application cannot be processed yet. Please return on or after the earliest eligible date shown." };
  if (snapshot.state === "SCHEDULED_FOR_SUBMISSION") return { ...common, state: "SCHEDULED_FOR_SUBMISSION",
    customerSafeExplanation: "You can complete your application now. TASHIRA will schedule submission closer to your planned travel date." };
  if (snapshot.state === "READY_FOR_SUBMISSION") return { ...common, state: "READY_FOR_SUBMISSION",
    customerSafeExplanation: "Your application is ready for the next submission step." };
  if (snapshot.state === "ALREADY_SUBMITTED") return { ...common, state: "SUBMITTED",
    customerSafeExplanation: "Your application has been submitted for processing." };
  return { ...common, state: "ACTION_REQUIRED",
    customerSafeExplanation: "Your application needs review or additional information before submission can continue." };
}

export function schedulerCommunicationEvents(input: {
  previous: SubmissionScheduleSnapshot | null;
  current: SubmissionScheduleSnapshot;
}): readonly SchedulerCommunicationEvent[] {
  const events: SchedulerCommunicationEvent[] = [];
  if (input.previous && input.previous.plannedArrivalDate !== input.current.plannedArrivalDate) events.push("TRAVEL_DATE_CHANGED");
  if (input.current.state === "SCHEDULED_FOR_SUBMISSION" && input.previous?.state !== input.current.state) events.push("APPLICATION_SCHEDULED_FOR_SUBMISSION");
  if (input.current.state === "BLOCKED_BY_REQUIREMENTS" && input.previous?.state !== input.current.state) events.push("SUBMISSION_DELAYED_BY_MISSING_DOCUMENT");
  if (input.current.state === "READY_FOR_SUBMISSION" && input.previous?.state !== input.current.state) events.push("APPLICATION_READY_FOR_SUBMISSION");
  if (input.current.state === "ALREADY_SUBMITTED" && input.previous?.state !== input.current.state) events.push("SUBMISSION_COMPLETED");
  return events;
}
