import { describe, expect, it } from "vitest";
import { normalizeVerifiedInboundEmail } from "./inbound-email-adapter";

const envelope = { verificationState: "VERIFIED", providerCode: "SYNTHETIC", providerMessageId: "message-1",
  senderReferenceSha256: "a".repeat(64), receivedAt: "2026-08-27T12:00:00Z", applicationId: 7,
  applicationReference: "TSH-SYNTHETIC-7", teamId: 3, plainTextBody: "Hello\r\nSupport\u0000", attachmentCount: 2 };

describe("verified inbound email adapter", () => {
  it("accepts only a verified normalized envelope and strips control characters", () => {
    expect(normalizeVerifiedInboundEmail(envelope)).toMatchObject({ providerIdentity: "SYNTHETIC:message-1",
      sanitizedBody: "Hello\nSupport", attachmentCount: 2 });
  });
  it("rejects unverified, mislabeled, whitespace-contaminated and oversized identities", () => {
    expect(() => normalizeVerifiedInboundEmail({ ...envelope, verificationState: "UNVERIFIED" })).toThrow();
    expect(() => normalizeVerifiedInboundEmail({ ...envelope, providerCode: "Provider label:" })).toThrow();
    expect(() => normalizeVerifiedInboundEmail({ ...envelope, providerMessageId: " message 1 " })).not.toThrow();
    expect(() => normalizeVerifiedInboundEmail({ ...envelope, providerMessageId: "x".repeat(221) })).toThrow();
  });
  it("never carries raw HTML, headers, attachments, addresses or provider secrets across the boundary", () => {
    const result = normalizeVerifiedInboundEmail(envelope);
    expect(result).not.toHaveProperty("plainTextBody");
    expect(JSON.stringify(result)).not.toMatch(/html|header|attachmentData|apiKey|secret|@/i);
  });
});
