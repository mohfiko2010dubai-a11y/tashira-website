import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), fee: vi.fn(), email: vi.fn(), event: vi.fn(), transition: vi.fn() }));
vi.mock("../queries/connection", () => ({ getDb: () => ({ select: mocks.select }) }));
vi.mock("./stripe-fee", () => ({ captureStripeFee: mocks.fee }));
vi.mock("./payment-success-email", () => ({ sendPaymentSuccessEmail: mocks.email }));
vi.mock("./application-timeline", () => ({ recordTimelineEvent: mocks.event, hasTimelineEvent: async () => false }));
vi.mock("./stripe", () => ({ retrieveStripeTestIntent: async () => ({}), verifyStripeIntent: () => true, retrieveStripeTestCardSummary: vi.fn() }));
vi.mock("./pricing-engine", () => ({ getApplicationPriceSnapshot: async () => ({ currency: "USD", totalPrice: "185.00" }), activeBusinessSettings: vi.fn() }));
vi.mock("./payment-state", () => ({ applyStripePaymentState: mocks.transition, SupersededStripeEvent: class extends Error {} }));
import { finalizeStripeTestPayment } from "./payment-finalization";

beforeEach(() => {
  vi.clearAllMocks();
  const records = [[{ id: 1, referenceNumber: "SYNTHETIC", contactEmail: "test@example.invalid" }],
    [{ id: 2, amount: "185.00", currency: "USD" }], [{ id: 3 }], [{ id: 3, invoiceNumber: "TEST-INV-00001", pdfPath: "archive" }]];
  mocks.select.mockImplementation(() => ({ from: () => ({ where: () => ({ limit: async () => records.shift() }) }) }));
  mocks.transition.mockResolvedValue({ paid: true, applied: false });
  mocks.event.mockResolvedValue(undefined);mocks.email.mockResolvedValue({ status: "SENT" });
});

describe("settlement fee is not a second payment gate", () => {
  it("returns confirmed payment and sends its notification while settlement is pending", async () => {
    mocks.fee.mockRejectedValue(new Error("Balance transaction pending"));
    const result = await finalizeStripeTestPayment("SYNTHETIC", "pi_test", { actorType: "CUSTOMER", eventSource: "PAYMENT_CONFIRM_API" });
    expect(result).toMatchObject({ success: true, feeReconciliationPending: true, invoiceNumber: "TEST-INV-00001" });
    expect(mocks.event).toHaveBeenCalledWith(expect.objectContaining({ eventName: "STRIPE_FEE_RECONCILIATION_PENDING" }));
    expect(mocks.email).toHaveBeenCalledOnce();
    expect(mocks.transition).toHaveBeenCalledOnce();
  });
  it("clears the pending result when webhook replay obtains the actual fee", async () => {
    mocks.fee.mockResolvedValue({ feeMinor: 3600, currency: "AED", transactionId: "txn_test" });
    const result = await finalizeStripeTestPayment("SYNTHETIC", "pi_test", { actorType: "STRIPE", eventSource: "STRIPE_WEBHOOK" });
    expect(result).toMatchObject({ success: true, feeReconciliationPending: false });
    expect(mocks.event).not.toHaveBeenCalled();
  });
});
