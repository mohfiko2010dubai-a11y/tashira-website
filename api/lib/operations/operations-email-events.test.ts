import { describe, expect, it } from "vitest";
import { OperationsEmailLedger, type OperationsEmailEvidence } from "./operations-email-events";
const evidence: OperationsEmailEvidence = { evidenceId: "e1", applicationId: 1, event: "APPLICATION_SCHEDULED_FOR_SUBMISSION", eventReference: "schedule:1", templateVersion: "v1", recipientReference: "customer:1", providerMessageId: null, deliveryStatus: "QUEUED", occurredAt: "2026-08-25T12:00:00Z", deduplicationKey: "app:1:schedule:1:v1" };
describe("operations email event ledger", () => {
  it("records canonical template evidence and rejects duplicate delivery intent", () => { const ledger = new OperationsEmailLedger(); expect(ledger.record(evidence)).toBe("RECORDED"); expect(ledger.record({ ...evidence, evidenceId: "retry" })).toBe("DUPLICATE"); expect(ledger.application(1)).toHaveLength(1); });
});
