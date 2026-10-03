import { describe, expect, it } from "vitest";
import { parseStripeFee } from "./stripe-fee";

describe("actual provider fee evidence", () => {
  it("retains exact minor units and settlement currency", () => {
    expect(parseStripeFee({ id: "pi_test", latest_charge: { balance_transaction: { id: "txn_test", fee: 2586, currency: "aed" } } }, "pi_test"))
      .toEqual({ transactionId: "txn_test", feeMinor: 2586, currency: "AED" });
  });
  it("does not invent a fee when settlement is pending", () => {
    expect(parseStripeFee({ id: "pi_test", latest_charge: null }, "pi_test")).toBeNull();
    expect(() => parseStripeFee({ id: "pi_other" }, "pi_test")).toThrow("mismatch");
    expect(() => parseStripeFee({ id: "pi_test", latest_charge: { balance_transaction: { id: "txn_test", fee: -1, currency: "aed" } } }, "pi_test")).toThrow("Invalid");
  });
});
