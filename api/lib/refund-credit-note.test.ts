import { describe, expect, it } from "vitest";
import { validateConfirmedRefund } from "./refund-credit-note";

describe("credit note requires confirmed refund evidence", () => {
  const refund = { id: "re_synthetic", payment_intent: "pi_synthetic", amount: 3000, currency: "usd", status: "succeeded" as const };
  const expected = { intent: "pi_synthetic", amount: "30.00", currency: "USD" };
  it("accepts exact verified amount, payment and currency", () => {
    expect(() => validateConfirmedRefund(refund, expected)).not.toThrow();
  });
  it("rejects pending refunds and mismatched financial evidence", () => {
    for (const value of [{ ...refund, status: "pending" as const }, { ...refund, amount: 1 },
      { ...refund, payment_intent: "pi_other" }, { ...refund, currency: "aed" }]) {
      expect(() => validateConfirmedRefund(value, expected)).toThrow("does not match");
    }
  });
});
