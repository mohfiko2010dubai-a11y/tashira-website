import { describe, expect, it } from "vitest";
import { resolvePaymentDisplayAmount } from "./payment-display-amount";

describe("resolvePaymentDisplayAmount", () => {
  it("uses the USD price snapshot when present", () => {
    expect(resolvePaymentDisplayAmount({ totalAmountUsd: "189.00", totalAmountAed: "700" }))
      .toEqual({ amount: 189, priceSnapshotMissing: false });
  });

  it("converts AED to USD when only the AED snapshot exists", () => {
    const result = resolvePaymentDisplayAmount({ totalAmountUsd: null, totalAmountAed: "367.00" });
    expect(result.priceSnapshotMissing).toBe(false);
    expect(result.amount).toBeCloseTo(100, 2);
  });

  it("accepts numeric snapshots", () => {
    expect(resolvePaymentDisplayAmount({ totalAmountUsd: 250 }).priceSnapshotMissing).toBe(false);
  });

  it("fails closed when both snapshots are missing", () => {
    expect(resolvePaymentDisplayAmount({ totalAmountUsd: null, totalAmountAed: null }))
      .toEqual({ amount: 0, priceSnapshotMissing: true });
  });

  it("fails closed on zero, negative or unparsable snapshots", () => {
    for (const app of [
      { totalAmountUsd: "0", totalAmountAed: "0" },
      { totalAmountUsd: "-50", totalAmountAed: null },
      { totalAmountUsd: "abc", totalAmountAed: "" },
      { totalAmountUsd: undefined, totalAmountAed: undefined },
    ]) {
      expect(resolvePaymentDisplayAmount(app).priceSnapshotMissing).toBe(true);
    }
  });
});
