import { describe, expect, it } from "vitest";
import { createRecoveryChallenge, DisabledRecoveryProvider, verifyRecoverySecret } from "./customer-recovery";
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
});
