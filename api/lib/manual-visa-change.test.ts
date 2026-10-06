import { describe, expect, it, vi } from "vitest";
vi.mock("./checkout-quote", () => ({ withCheckoutLock: vi.fn() }));
vi.mock("./operations/mysql-query-client", () => ({ defaultOperationsPool: vi.fn() }));
import { validateManualChange, type ManualChangeRequest } from "./manual-visa-change";
const quote = { state: "ACCEPTED", difference_minor: 3000, old_total_minor: 18500 };
const settlement: ManualChangeRequest = { quoteId: "synthetic", version: 1, kind: "SETTLEMENT", direction: "TOP_UP", amountMinor: 3000, currency: "USD", stripeReference: "pi_synthetic", reason: "Checked completed payment" };
describe("manual amendment settlement evidence", () => {
  it("accepts the exact completed difference", () => expect(() => validateManualChange(quote, settlement)).not.toThrow());
  it.each([
    { stripeReference: undefined }, { stripeReference: "https://buy.stripe.com/test" }, { stripeReference: "re_wrong_direction" },
    { amountMinor: 2999 }, { direction: "REFUND" as const }, { reason: "" },
  ])("rejects incomplete or inconsistent evidence %j", change => expect(() => validateManualChange(quote, { ...settlement, ...change })).toThrow());
  it("does not treat refusal as settlement", () => expect(() => validateManualChange({ ...quote, state: "REFUSED" }, settlement)).toThrow());
  it("accepts a completed cheaper-product refund", () => expect(() => validateManualChange({ ...quote, difference_minor: -3000 }, { ...settlement, direction: "REFUND", stripeReference: "re_synthetic" })).not.toThrow());
  it("requires written insistence and risk for original-product filing", () => {
    const request: ManualChangeRequest = { quoteId: "synthetic", version: 1, kind: "REFUSAL_OUTCOME", outcome: "ORIGINAL_AT_CUSTOMER_REQUEST", reason: "Customer requested original" };
    expect(() => validateManualChange({ ...quote, state: "REFUSED" }, request)).toThrow();
    expect(() => validateManualChange({ ...quote, state: "REFUSED" }, { ...request, writtenInsistence: "Customer written instruction", riskRecord: "Eligibility risk explained" })).not.toThrow();
  });
  it("requires the full previous total for full-refund cancellation", () => {
    const request = { ...settlement, kind: "REFUSAL_OUTCOME" as const, outcome: "FULL_REFUND_CANCEL" as const, direction: "REFUND" as const, stripeReference: "re_synthetic" };
    expect(() => validateManualChange({ ...quote, state: "REFUSED" }, request)).toThrow();
    expect(() => validateManualChange({ ...quote, state: "REFUSED" }, { ...request, amountMinor: 18500 })).not.toThrow();
  });
});
