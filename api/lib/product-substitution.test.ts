import { beforeEach, describe, expect, it, vi } from "vitest";
const hooks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("./checkout-quote", () => ({ withCheckoutLock: async (_id: number, action: (connection: { execute: typeof hooks.execute }) => unknown) => action({ execute: hooks.execute }) }));
vi.mock("./visa-change-quotes", () => ({ prepareVisaChangeQuote: vi.fn(), acceptVisaChangeQuote: vi.fn() }));
import { acknowledgeSubmittedProduct, proposeSubmittedProduct } from "./product-substitution";

beforeEach(() => hooks.execute.mockReset());
describe("versioned product acknowledgement", () => {
  it("invalidates old consent without changing the product sold", async () => {
    hooks.execute.mockResolvedValueOnce([[{ status: "under_review", visa_type: "30days-single", substitution_version: 2 }]])
      .mockResolvedValueOnce([[{ service_code: "14days-single" }]]).mockResolvedValue([[]]);
    expect(await proposeSubmittedProduct(1, "14days-single", "staff:7", "Synthetic review reason")).toEqual({ version: 3 });
    expect(hooks.execute.mock.calls[2][0]).toContain("substitution_acknowledged_version=NULL");
    expect(hooks.execute.mock.calls[2][0]).not.toContain("visa_type=");
    expect(hooks.execute.mock.calls[3][1]).toEqual([1, 3, "14days-single", "staff:7", "Synthetic review reason"]);
  });
  it("refuses stale consent and does not write it", async () => {
    hooks.execute.mockResolvedValue([[{ submitted_product: "14days-single", substitution_version: 3 }]]);
    await expect(acknowledgeSubmittedProduct(1, 2)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(hooks.execute).toHaveBeenCalledTimes(1);
  });
  it("records current consent once and treats a retry as idempotent", async () => {
    hooks.execute.mockResolvedValueOnce([[{ submitted_product: "14days-single", substitution_version: 3, substitution_acknowledged_version: null }]]).mockResolvedValue([[]]);
    expect(await acknowledgeSubmittedProduct(1, 3)).toEqual({ acknowledged: true });
    expect(hooks.execute).toHaveBeenCalledTimes(3);
    hooks.execute.mockReset().mockResolvedValue([[{ submitted_product: "14days-single", substitution_version: 3, substitution_acknowledged_version: 3 }]]);
    await acknowledgeSubmittedProduct(1, 3);
    expect(hooks.execute).toHaveBeenCalledTimes(1);
  });
  it("will not rewrite a filed order", async () => {
    hooks.execute.mockResolvedValue([[{ status: "visa_processing" }]]);
    await expect(proposeSubmittedProduct(1, "14days-single", "staff:7", "Synthetic review reason")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(hooks.execute).toHaveBeenCalledTimes(1);
  });
});
