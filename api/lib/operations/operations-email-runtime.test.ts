import { describe, expect, it } from "vitest";
import type { OperationsEmailEvidence } from "./operations-email-events";
import { queueOperationsEmailBehindFlag } from "./operations-email-runtime";

const queued: OperationsEmailEvidence = {
  evidenceId: "e1",
  applicationId: 1,
  event: "APPLICATION_RECEIVED",
  eventReference: "timeline-1",
  templateVersion: "application-received-v1",
  recipientReference: "sha256:review",
  providerMessageId: null,
  deliveryStatus: "QUEUED",
  occurredAt: "2026-08-26T12:00:00.000Z",
  deduplicationKey: "timeline-1:application-received-v1",
};
const input = {
  timelineEventId: "timeline-1",
  event: "APPLICATION_RECEIVED" as const,
  templateVersion: "application-received-v1",
  deduplicationKey: "timeline-1:application-received-v1",
  occurredAt: "2026-08-26T12:00:00.000Z",
  context: { environment: "TEST" as const, applicationReference: "TSH-1" },
  repository: { queue: async () => queued },
};

describe("operations email runtime", () => {
  it("queues trusted evidence only behind the closed flag", async () => {
    await expect(
      queueOperationsEmailBehindFlag({ ...input, flags: [] })
    ).resolves.toBeNull();
    await expect(
      queueOperationsEmailBehindFlag({
        ...input,
        flags: [
          {
            flagKey: "OPERATIONS_EMAIL_AUTOMATION",
            environment: "TEST",
            enabled: true,
            scopeType: "APPLICATION",
            scopeReference: "TSH-1",
          },
        ],
      })
    ).resolves.toEqual(queued);
  });
  it("rejects incomplete queue evidence", async () => {
    await expect(
      queueOperationsEmailBehindFlag({
        ...input,
        templateVersion: "",
        flags: [
          {
            flagKey: "OPERATIONS_EMAIL_AUTOMATION",
            environment: "TEST",
            enabled: true,
            scopeType: "APPLICATION",
            scopeReference: "TSH-1",
          },
        ],
      })
    ).rejects.toThrow("OPERATIONS_EMAIL_QUEUE_EVIDENCE_REQUIRED");
  });
});
