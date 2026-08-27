import { describe, expect, it, vi } from "vitest";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import { ingestVerifiedInboundEmail } from "./inbound-email-service";

const envelope = { verificationState: "VERIFIED", providerCode: "SYNTHETIC", providerMessageId: "message-1",
  senderReferenceSha256: "a".repeat(64), receivedAt: "2026-08-27T12:00:00Z", applicationId: 7,
  applicationReference: "TSH-SYNTHETIC-7", teamId: 3, plainTextBody: "Status request", attachmentCount: 0 };
const flag: FeatureFlagRecord = { flagKey: "SUPPORT_INBOX", environment: "TEST", enabled: true, scopeType: "APPLICATION", scopeReference: "TSH-SYNTHETIC-7" };

describe("inbound support email service", () => {
  it("fails closed before normalization or persistence while Support Inbox is disabled", async () => {
    const repository = { ingest: vi.fn() };
    await expect(ingestVerifiedInboundEmail({ envelope, context: { environment: "TEST", applicationReference: "TSH-SYNTHETIC-7" }, flags: [], repository }))
      .rejects.toThrow("INBOUND_EMAIL_DISABLED");
    expect(repository.ingest).not.toHaveBeenCalled();
  });
  it("passes only normalized verified evidence to persistence", async () => {
    const repository = { ingest: vi.fn(async () => ({ state: "INGESTED" as const, threadId: "t1", messageId: "m1" })) };
    await expect(ingestVerifiedInboundEmail({ envelope, context: { environment: "TEST", applicationReference: "TSH-SYNTHETIC-7" }, flags: [flag], repository }))
      .resolves.toMatchObject({ state: "INGESTED" });
    expect(repository.ingest).toHaveBeenCalledWith(expect.objectContaining({ providerIdentity: "SYNTHETIC:message-1", evidenceSha256: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  });
});
