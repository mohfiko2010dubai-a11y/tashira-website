import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTransactionalEmail } from "./transactional-email";
import { verifySecurityDepositIntent } from "./stripe";
import { securityDepositRetryIdempotencyKey, securityDepositTokenHash } from "./security-deposit-capability";

describe("security deposit capability", () => {
  beforeEach(() => { process.env.PUBLIC_APP_URL = "https://staging.tashiraev.com"; });
  afterEach(() => { delete process.env.PUBLIC_APP_URL; });

  it("renders only a same-origin, single-purpose deposit capability", () => {
    const token = "a".repeat(43);
    const email = renderTransactionalEmail("SECURITY_DEPOSIT_REQUEST", {
      referenceNumber: "TSH-123456",
      amount: "2500.00",
      currency: "AED",
      purpose: "Refundable processing guarantee",
      depositUrl: `https://staging.tashiraev.com/deposit/${token}`,
      expiresAt: "2026-09-01T00:00:00.000Z",
    });
    expect(email.html).toContain(`href="https://staging.tashiraev.com/deposit/${token}"`);
    expect(email.body).not.toContain("passport");
    expect(() => renderTransactionalEmail("SECURITY_DEPOSIT_REQUEST", {
      referenceNumber: "TSH-123456", amount: "2500.00", currency: "AED", purpose: "Guarantee",
      depositUrl: `https://evil.example/deposit/${token}`, expiresAt: "2026-09-01T00:00:00.000Z",
    })).toThrow("origin is not approved");
  });

  it("hashes capability tokens deterministically without retaining the token", () => {
    const token = "b".repeat(43);
    expect(securityDepositTokenHash(token)).toMatch(/^[a-f0-9]{64}$/u);
    expect(securityDepositTokenHash(token)).not.toContain(token);
  });

  it("uses the rotated token hash to isolate each safe retry", () => {
    const firstHash = securityDepositTokenHash("b".repeat(43));
    const secondHash = securityDepositTokenHash("c".repeat(43));
    const first = securityDepositRetryIdempotencyKey("request-id", firstHash);
    const second = securityDepositRetryIdempotencyKey("request-id", secondHash);
    expect(first).not.toBe(second);
    expect(first).not.toContain("b".repeat(43));
  });

  it("verifies the exact AED amount and request ownership", () => {
    const intent = {
      id: "pi_deposit", client_secret: "secret", status: "succeeded", amount: 250000,
      amount_received: 250000, currency: "aed", metadata: { securityDepositRequestId: "request-id" },
    };
    expect(verifySecurityDepositIntent({ intent, paymentIntentId: "pi_deposit", requestId: "request-id", expectedAmountCents: 250000 })).toBe(true);
    expect(verifySecurityDepositIntent({ intent, paymentIntentId: "pi_deposit", requestId: "other", expectedAmountCents: 250000 })).toBe(false);
    expect(verifySecurityDepositIntent({ intent, paymentIntentId: "pi_deposit", requestId: "request-id", expectedAmountCents: 249999 })).toBe(false);
  });
});
