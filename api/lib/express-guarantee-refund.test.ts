import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROCESSING_GUARANTEE_VERSION } from "../../contracts/processing-guarantee";
const mocks = vi.hoisted(() => ({ execute: vi.fn(), insert: vi.fn(), values: vi.fn() }));
vi.mock("./checkout-quote", () => ({ withCheckoutLock: (_id: number, work: (c: object) => Promise<unknown>) => work({ execute: mocks.execute }) }));
vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => ({ insert: mocks.insert }) }));
vi.mock("./operations/mysql-query-client", () => ({ defaultOperationsPool: () => ({ execute: mocks.execute }) }));
import { createExpressGuaranteeRefund } from "./express-guarantee-refund";

describe("Express guarantee refund claim", () => {
  const row = () => ({ payment_status: "paid", processing_type: "express", documents_completed_at: (Date.now() - 25 * 3_600_000) / 1000,
    authority_submitted_at: null, quote_json: { processingGuaranteeVersion: PROCESSING_GUARANTEE_VERSION, expressFeeTotal: 112.5, totalPrice: 667.5, currency: "USD" } });
  beforeEach(() => { vi.clearAllMocks(); mocks.insert.mockReturnValue({ values: mocks.values }); mocks.values.mockResolvedValue(undefined); });
  it("creates a separate full-fee case with no deduction, not the base price", async () => {
    mocks.execute.mockResolvedValueOnce([[row()]]).mockResolvedValueOnce([[{ id: 7, amount: "667.50", currency: "usd" }]])
      .mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([{}]);
    const result = await createExpressGuaranteeRefund(1, "admin-session");
    expect(result.replayed).toBe(false);
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ requestedAmount: "112.50", refundAmount: "112.50", deductionType: "NONE", paymentId: 7, idempotencyKey: `express-guarantee-1-${PROCESSING_GUARANTEE_VERSION}` }));
  });
  it("returns the existing case on a repeated click without inserting a second refund", async () => {
    mocks.execute.mockResolvedValueOnce([[{ ...row(), express_refund_case_id: "saved-case" }]]);
    await expect(createExpressGuaranteeRefund(1, "admin-session")).resolves.toEqual({ refundCaseId: "saved-case", replayed: true });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(["legacy", "unpaid", "regular", "in-time", "no-completion"])("refuses an ineligible %s order", async scenario => {
    const item = row();
    if (scenario === "legacy") item.quote_json.processingGuaranteeVersion = "old";
    if (scenario === "unpaid") item.payment_status = "pending";
    if (scenario === "regular") item.processing_type = "regular";
    if (scenario === "in-time") item.documents_completed_at = Date.now() / 1000;
    mocks.execute.mockResolvedValueOnce([[scenario === "no-completion" ? { ...item, documents_completed_at: null } : item]]);
    await expect(createExpressGuaranteeRefund(1, "admin-session")).rejects.toThrow("no overdue paid Express guarantee");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("does not double-reserve money already assigned to another refund", async () => {
    mocks.execute.mockResolvedValueOnce([[row()]]).mockResolvedValueOnce([[{ id: 7, amount: "667.50", currency: "usd" }]])
      .mockResolvedValueOnce([[{ total: 667.5 }]]);
    await expect(createExpressGuaranteeRefund(1, "admin-session")).rejects.toThrow("existing refund");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
