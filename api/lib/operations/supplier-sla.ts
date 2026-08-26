export type SupplierSlaState =
  | "WAITING_FOR_ACKNOWLEDGEMENT"
  | "ACKNOWLEDGEMENT_OVERDUE"
  | "IN_PROGRESS"
  | "COMPLETION_WARNING"
  | "COMPLETION_OVERDUE"
  | "COMPLETED";

export type SupplierSlaPolicySnapshot = {
  policyId: string;
  policyVersion: number;
  supplierId: number;
  routeCode: string | null;
  acknowledgementMinutes: number;
  completionMinutes: number;
  warningMinutesBeforeCompletion: number;
  sourceReference: string;
};

export type SupplierSlaEvent = {
  eventId: string;
  eventType: "STARTED" | "ACKNOWLEDGED" | "ESCALATED" | "COMPLETED";
  actorReference: string;
  reason: string;
  occurredAt: string;
  idempotencyKey: string;
};

export type SupplierSlaSnapshot = {
  slaId: string;
  applicationId: number;
  supplierId: number;
  policy: SupplierSlaPolicySnapshot;
  startedAt: string;
  acknowledgementDueAt: string;
  completionDueAt: string;
  events: readonly SupplierSlaEvent[];
  evidenceIntegrityReference: string;
};

function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`SUPPLIER_SLA_INVALID_${name}`);
}

function instant(value: string, name: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`SUPPLIER_SLA_INVALID_${name}`);
  return parsed;
}

function addMinutes(value: string, minutes: number): string {
  return new Date(instant(value, "STARTED_AT") + minutes * 60_000).toISOString();
}

export function createSupplierSlaSnapshot(input: {
  slaId: string;
  applicationId: number;
  supplierId: number;
  policy: SupplierSlaPolicySnapshot;
  startedAt: string;
  startEvent: SupplierSlaEvent;
  evidenceIntegrityReference: string;
}): SupplierSlaSnapshot {
  positiveInteger(input.applicationId, "APPLICATION_ID");
  positiveInteger(input.supplierId, "SUPPLIER_ID");
  positiveInteger(input.policy.policyVersion, "POLICY_VERSION");
  positiveInteger(input.policy.acknowledgementMinutes, "ACKNOWLEDGEMENT_MINUTES");
  positiveInteger(input.policy.completionMinutes, "COMPLETION_MINUTES");
  if (!Number.isSafeInteger(input.policy.warningMinutesBeforeCompletion) || input.policy.warningMinutesBeforeCompletion < 0
    || input.policy.warningMinutesBeforeCompletion >= input.policy.completionMinutes) throw new Error("SUPPLIER_SLA_INVALID_WARNING_MINUTES");
  if (input.policy.supplierId !== input.supplierId) throw new Error("SUPPLIER_SLA_SUPPLIER_MISMATCH");
  if (input.policy.acknowledgementMinutes >= input.policy.completionMinutes) throw new Error("SUPPLIER_SLA_INVALID_DEADLINE_ORDER");
  if (input.startEvent.eventType !== "STARTED" || instant(input.startEvent.occurredAt, "EVENT_TIME") !== instant(input.startedAt, "STARTED_AT")) {
    throw new Error("SUPPLIER_SLA_INVALID_START_EVENT");
  }
  return {
    slaId: input.slaId,
    applicationId: input.applicationId,
    supplierId: input.supplierId,
    policy: structuredClone(input.policy),
    startedAt: new Date(instant(input.startedAt, "STARTED_AT")).toISOString(),
    acknowledgementDueAt: addMinutes(input.startedAt, input.policy.acknowledgementMinutes),
    completionDueAt: addMinutes(input.startedAt, input.policy.completionMinutes),
    events: [structuredClone(input.startEvent)],
    evidenceIntegrityReference: input.evidenceIntegrityReference,
  };
}

export function appendSupplierSlaEvent(snapshot: SupplierSlaSnapshot, event: SupplierSlaEvent): SupplierSlaSnapshot {
  if (snapshot.events.some((item) => item.idempotencyKey === event.idempotencyKey)) {
    const existing = snapshot.events.find((item) => item.idempotencyKey === event.idempotencyKey);
    if (JSON.stringify(existing) !== JSON.stringify(event)) throw new Error("SUPPLIER_SLA_IDEMPOTENCY_CONFLICT");
    return structuredClone(snapshot);
  }
  if (snapshot.events.some((item) => item.eventId === event.eventId)) throw new Error("SUPPLIER_SLA_EVENT_ID_CONFLICT");
  const occurredAt = instant(event.occurredAt, "EVENT_TIME");
  const last = snapshot.events.at(-1);
  if (last && occurredAt < instant(last.occurredAt, "EVENT_TIME")) throw new Error("SUPPLIER_SLA_EVENT_TIME_REGRESSION");
  if (snapshot.events.some((item) => item.eventType === "COMPLETED")) throw new Error("SUPPLIER_SLA_ALREADY_COMPLETED");
  if (event.eventType === "STARTED") throw new Error("SUPPLIER_SLA_ALREADY_STARTED");
  if (event.eventType === "ACKNOWLEDGED" && snapshot.events.some((item) => item.eventType === "ACKNOWLEDGED")) {
    throw new Error("SUPPLIER_SLA_ALREADY_ACKNOWLEDGED");
  }
  return { ...structuredClone(snapshot), events: [...snapshot.events.map((item) => structuredClone(item)), structuredClone(event)] };
}

export function deriveSupplierSlaState(snapshot: SupplierSlaSnapshot, evaluatedAt: string): SupplierSlaState {
  const now = instant(evaluatedAt, "EVALUATED_AT");
  if (snapshot.events.some((event) => event.eventType === "COMPLETED")) return "COMPLETED";
  const acknowledged = snapshot.events.some((event) => event.eventType === "ACKNOWLEDGED");
  if (!acknowledged) return now > instant(snapshot.acknowledgementDueAt, "ACK_DUE_AT")
    ? "ACKNOWLEDGEMENT_OVERDUE" : "WAITING_FOR_ACKNOWLEDGEMENT";
  const completion = instant(snapshot.completionDueAt, "COMPLETION_DUE_AT");
  if (now > completion) return "COMPLETION_OVERDUE";
  const warningAt = completion - snapshot.policy.warningMinutesBeforeCompletion * 60_000;
  return now >= warningAt ? "COMPLETION_WARNING" : "IN_PROGRESS";
}
