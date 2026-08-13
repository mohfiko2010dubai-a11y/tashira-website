import { describe, expect, it } from "vitest";
import { paymentViewState } from "../../src/lib/payment-view-state";

describe("payment success view state", () => {
  it("removes checkout after verified browser confirmation", () => {
    expect(paymentViewState({ paymentStatus: "pending", browserConfirmed: true, confirmationPending: false })).toBe("confirmed");
  });

  it("keeps refresh and back navigation on the canonical paid view", () => {
    expect(paymentViewState({ paymentStatus: "paid", browserConfirmed: false, confirmationPending: false })).toBe("confirmed");
  });

  it("shows a safe bounded confirmation state instead of another checkout", () => {
    expect(paymentViewState({ paymentStatus: "pending", browserConfirmed: false, confirmationPending: true })).toBe("confirming");
  });
});
