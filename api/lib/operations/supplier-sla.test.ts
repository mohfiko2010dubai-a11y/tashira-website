import { describe, expect, it } from "vitest";
import { appendSupplierSlaEvent, createSupplierSlaSnapshot, deriveSupplierSlaState, type SupplierSlaEvent } from "./supplier-sla";

const policy = { policyId: "policy-1", policyVersion: 3, supplierId: 9, routeCode: "UAE_30",
  acknowledgementMinutes: 60, completionMinutes: 240, warningMinutesBeforeCompletion: 30, sourceReference: "approved-policy:3" };
const event = (eventType: SupplierSlaEvent["eventType"], occurredAt: string, key: string = eventType): SupplierSlaEvent => ({
  eventId: `event-${key}`, eventType, actorReference: "staff:7", reason: "Operational evidence", occurredAt, idempotencyKey: key,
});
const snapshot = () => createSupplierSlaSnapshot({ slaId: "sla-1", applicationId: 11, supplierId: 9, policy,
  startedAt: "2026-08-26T10:00:00.000Z", startEvent: event("STARTED", "2026-08-26T10:00:00.000Z"), evidenceIntegrityReference: "sha256:evidence" });

describe("supplier SLA", () => {
  it("derives acknowledgement, warning and overdue states from an explicit immutable policy", () => {
    const started = snapshot();
    expect(deriveSupplierSlaState(started, "2026-08-26T10:30:00.000Z")).toBe("WAITING_FOR_ACKNOWLEDGEMENT");
    expect(deriveSupplierSlaState(started, "2026-08-26T11:01:00.000Z")).toBe("ACKNOWLEDGEMENT_OVERDUE");
    const acknowledged = appendSupplierSlaEvent(started, event("ACKNOWLEDGED", "2026-08-26T10:45:00.000Z"));
    expect(deriveSupplierSlaState(acknowledged, "2026-08-26T12:00:00.000Z")).toBe("IN_PROGRESS");
    expect(deriveSupplierSlaState(acknowledged, "2026-08-26T13:30:00.000Z")).toBe("COMPLETION_WARNING");
    expect(deriveSupplierSlaState(acknowledged, "2026-08-26T14:01:00.000Z")).toBe("COMPLETION_OVERDUE");
  });

  it("preserves event history and returns deterministic replay without rewriting evidence", () => {
    const acknowledged = appendSupplierSlaEvent(snapshot(), event("ACKNOWLEDGED", "2026-08-26T10:45:00.000Z", "ack"));
    expect(appendSupplierSlaEvent(acknowledged, event("ACKNOWLEDGED", "2026-08-26T10:45:00.000Z", "ack"))).toEqual(acknowledged);
    expect(() => appendSupplierSlaEvent(acknowledged, { ...event("ACKNOWLEDGED", "2026-08-26T10:46:00.000Z", "ack") })).toThrow("SUPPLIER_SLA_IDEMPOTENCY_CONFLICT");
    const completed = appendSupplierSlaEvent(acknowledged, event("COMPLETED", "2026-08-26T13:00:00.000Z"));
    expect(deriveSupplierSlaState(completed, "2026-08-27T10:00:00.000Z")).toBe("COMPLETED");
    expect(completed.events).toHaveLength(3);
  });

  it("fails closed on supplier mismatch, invented defaults and invalid chronology", () => {
    expect(() => createSupplierSlaSnapshot({ slaId: "sla", applicationId: 1, supplierId: 8, policy,
      startedAt: "2026-08-26T10:00:00Z", startEvent: event("STARTED", "2026-08-26T10:00:00Z"), evidenceIntegrityReference: "sha256:x" })).toThrow("SUPPLIER_SLA_SUPPLIER_MISMATCH");
    expect(() => createSupplierSlaSnapshot({ slaId: "sla", applicationId: 1, supplierId: 9,
      policy: { ...policy, acknowledgementMinutes: 0 }, startedAt: "2026-08-26T10:00:00Z",
      startEvent: event("STARTED", "2026-08-26T10:00:00Z"), evidenceIntegrityReference: "sha256:x" })).toThrow("SUPPLIER_SLA_INVALID_ACKNOWLEDGEMENT_MINUTES");
    expect(() => appendSupplierSlaEvent(snapshot(), event("ACKNOWLEDGED", "2026-08-26T09:59:00.000Z"))).toThrow("SUPPLIER_SLA_EVENT_TIME_REGRESSION");
  });
});
