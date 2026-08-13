import { describe, expect, it } from "vitest";
import { createRecoveryChallenge, DisabledRecoveryProvider, recoveryExpiry, recoveryVerificationDecision, verifyRecoverySecret } from "./customer-recovery";
import { validateTemplateVariables } from "./transactional-email";

describe("provider-independent recovery", () => {
  it("stores only hashes and verifies secrets safely", () => {
    const challenge = createRecoveryChallenge("EMAIL_OTP", "customer@example.com");
    expect(challenge.secret).toMatch(/^\d{6}$/);
    expect(challenge.tokenHash).not.toContain(challenge.secret);
    expect(verifyRecoverySecret(challenge.secret, challenge.tokenHash)).toBe(true);
    expect(verifyRecoverySecret("000000", challenge.tokenHash)).toBe(false);
  });

  it("keeps delivery disabled by default", async () => {
    await expect(new DisabledRecoveryProvider().deliver()).rejects.toThrow("not enabled");
  });

  it("validates template contracts without sending", () => {
    expect(() => validateTemplateVariables("PAYMENT_SUCCESS", { referenceNumber: "TSH-1" })).toThrow("invoiceNumber");
  });

  it("enforces expiry, single use, and retry limits", () => {
    const future = new Date("2026-01-01T00:10:00Z");
    const now = new Date("2026-01-01T00:00:00Z");
    expect(recoveryVerificationDecision({ expiresAt: future, consumedAt: null, attemptCount: 0 }, true, now)).toBe("ACCEPT");
    expect(recoveryVerificationDecision({ expiresAt: now, consumedAt: null, attemptCount: 0 }, true, now)).toBe("EXPIRED");
    expect(recoveryVerificationDecision({ expiresAt: future, consumedAt: now, attemptCount: 0 }, true, now)).toBe("CONSUMED");
    expect(recoveryVerificationDecision({ expiresAt: future, consumedAt: null, attemptCount: 5 }, true, now)).toBe("LOCKED");
    expect(recoveryVerificationDecision({ expiresAt: future, consumedAt: null, attemptCount: 1 }, false, now)).toBe("INVALID");
  });

  it("uses short channel-specific expiry windows", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(recoveryExpiry("MAGIC_LINK", now).toISOString()).toBe("2026-01-01T00:15:00.000Z");
    expect(recoveryExpiry("EMAIL_OTP", now).toISOString()).toBe("2026-01-01T00:10:00.000Z");
  });
});
