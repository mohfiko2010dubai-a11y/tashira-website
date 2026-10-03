import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentNumberChanged, retryableFinancialConflict } from "./financial-document-series";

const hooks = vi.hoisted(() => ({ prepare: vi.fn(), issue: vi.fn(), lock: vi.fn() }));
vi.mock("./invoice-archive", () => ({ preparePaidInvoice: hooks.prepare, issuePaidInvoice: hooks.issue }));
vi.mock("./checkout-quote", () => ({ withCheckoutLock: hooks.lock }));
import { applyStripePaymentState } from "./payment-state";

afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });
describe("invoice retry ordering", () => {
  it("renders again outside the transaction after a candidate collision", async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    hooks.prepare.mockImplementation(async () => { events.push("render"); return {}; });
    hooks.lock.mockImplementationOnce(async () => { events.push("rollback"); throw new DocumentNumberChanged(); })
      .mockImplementationOnce(async () => { events.push("commit"); return { paid: true, applied: true }; });
    const result = applyStripePaymentState({ applicationId: 1, paymentId: 1, paymentIntentId: "pi_synthetic",
      target: "paid", actorType: "STRIPE", eventSource: "SYNTHETIC", invoice: { data: {
        referenceNumber: "SYNTHETIC", customerName: "Synthetic Customer", customerEmail: "ci@example.invalid", customerPhone: "000",
        passportNumber: "SYNTHETIC", passportExpiry: "2030-01-01", nationality: "EG", visaType: "30days-single", processingType: "regular",
        applicantCount: 1, unitPriceInBaseCurrency: 367, baseCurrency: "AED", exchangeRateToBase: 3.67,
        totalAmount: 100, currency: "USD", payerName: "Synthetic Customer", payerRelationship: "Self",
      }, isTest: true, vatRate: "0" } });
    await vi.runAllTimersAsync();
    expect(await result).toEqual({ paid: true, applied: true });
    expect(events).toEqual(["render", "rollback", "render", "commit"]);
  });
  it("never prepares an invoice for a declined payment", async () => {
    hooks.lock.mockResolvedValueOnce({ paid: false, applied: true });
    await applyStripePaymentState({ applicationId: 1, paymentId: 1, paymentIntentId: "pi_synthetic",
      target: "failed", actorType: "STRIPE", eventSource: "SYNTHETIC" });
    expect(hooks.prepare).not.toHaveBeenCalled();
  });
  it("recognizes wrapped MySQL contention without retrying unrelated errors", () => {
    expect(retryableFinancialConflict(new Error("query", { cause: { code: "ER_LOCK_DEADLOCK" } }))).toBe(true);
    expect(retryableFinancialConflict({ code: "ER_LOCK_WAIT_TIMEOUT" })).toBe(true);
    expect(retryableFinancialConflict(new Error("PDF failed"))).toBe(false);
  });
});
