import { describe, expect, it } from "vitest";
import {
  claimAnalyticsEvent,
  GA4_MEASUREMENT_ID,
  safeFunnelParameters,
  verifiedPaymentConversionParameters,
} from "../../src/lib/google-conversion-decision";

describe("GA4 verified payment conversion", () => {
  it("uses the approved Production measurement ID", () => {
    expect(GA4_MEASUREMENT_ID).toBe("G-650XVXCSYB");
  });

  it("uses the authoritative paid value, currency, and non-PII Stripe transaction ID", () => {
    expect(verifiedPaymentConversionParameters(
      { paymentStatus: "succeeded", transactionId: "pi_123456789", value: 170, currency: "usd" },
    )).toEqual({
      transaction_id: "pi_123456789",
      value: 170,
      currency: "USD",
    });
  });

  it.each(["failed", "requires_action"] as const)("does not emit for %s payments", (paymentStatus) => {
    expect(verifiedPaymentConversionParameters({
      paymentStatus,
      transactionId: "pi_123456789",
      value: 170,
      currency: "USD",
    })).toBeNull();
  });

  it("rejects application references, invalid values, and malformed currency", () => {
    expect(verifiedPaymentConversionParameters({
      paymentStatus: "succeeded", transactionId: "TSH-123456", value: 170, currency: "USD",
    })).toBeNull();
    expect(verifiedPaymentConversionParameters({
      paymentStatus: "succeeded", transactionId: "pi_123456789", value: 0, currency: "USD",
    })).toBeNull();
    expect(verifiedPaymentConversionParameters({
      paymentStatus: "succeeded", transactionId: "pi_123456789", value: 170, currency: "US dollars",
    })).toBeNull();
  });

  it("allows an event only once in persistent browser storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(claimAnalyticsEvent(storage, "purchase_pi_123")).toBe(true);
    expect(claimAnalyticsEvent(storage, "purchase_pi_123")).toBe(false);
  });

  it("drops PII and accepts only approved funnel parameters", () => {
    expect(safeFunnelParameters("application_submitted", {
      applicant_count: 2,
      application_type: "family",
      email: "customer@example.com",
      phone: "+971000000000",
      passport_number: "A1234567",
      nationality: "Example",
    })).toEqual({ applicant_count: 2, application_type: "family" });
    expect(safeFunnelParameters("begin_checkout", {
      value: 315,
      currency: "USD",
      reference_number: "TSH-123456",
    })).toEqual({ value: 315, currency: "USD" });
  });
});
