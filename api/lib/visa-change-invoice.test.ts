import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoolConnection } from "mysql2/promise";
const mocks = vi.hoisted(() => ({ issue: vi.fn(), execute: vi.fn() }));
vi.mock("./financial-document-series", () => ({ issueFinancialDocument: mocks.issue, prepareFinancialDocument: vi.fn() }));
import { issueVisaChangeInvoice, type preparePaidInvoice } from "./invoice-archive";
const prepared: Awaited<ReturnType<typeof preparePaidInvoice>> = {
  amount: "30.00", vatRate: "0.00", settingsVersion: 5,
  document: { applicationId: 7, paymentId: 12, issuanceKey: "payment:12", issuedAt: new Date("2026-10-07T00:00:00Z"),
    series: "TEST-INV", sequence: 2, number: "TEST-INV-00002", pdf: Buffer.from("%PDF-test"), sha256: "test", snapshotJson: "{}" },
};
beforeEach(() => {
  vi.clearAllMocks(); mocks.issue.mockResolvedValue({ number: "TEST-INV-00002", replay: false });
  mocks.execute.mockResolvedValueOnce([[{ amount: "30.00", difference_minor: 3000 }]]).mockResolvedValue([[]]);
});
describe("separate difference invoice", () => {
  it("issues only the additional amount without rewriting the original invoice", async () => {
    const number = await issueVisaChangeInvoice({ execute: mocks.execute } as unknown as PoolConnection, 7, 12, "quote-test", prepared);
    expect(number).toBe("TEST-INV-00002");
    expect(mocks.issue).toHaveBeenCalledOnce();
    expect(mocks.execute.mock.calls.at(-1)?.[1]).toEqual(["TEST-INV-00002", 7, 12, "30.00", "0.00", "archive:TEST-INV-00002", 5]);
    expect(mocks.execute.mock.calls.some(([sql]) => /UPDATE applications|UPDATE invoices/.test(sql))).toBe(false);
  });
  it("reuses this payment's invoice on webhook retry", async () => {
    mocks.execute.mockReset().mockResolvedValueOnce([[{ amount: "30.00", difference_minor: 3000 }]])
      .mockResolvedValueOnce([[{ invoice_number: "TEST-INV-00002", amount: "30.00" }]]);
    expect(await issueVisaChangeInvoice({ execute: mocks.execute } as unknown as PoolConnection, 7, 12, "quote-test", prepared)).toBe("TEST-INV-00002");
    expect(mocks.issue).not.toHaveBeenCalled();
  });
  it("refuses the full new visa total in place of the difference", async () => {
    await expect(issueVisaChangeInvoice({ execute: mocks.execute } as unknown as PoolConnection, 7, 12, "quote-test", { ...prepared, amount: "215.00" })).rejects.toThrow("difference payment");
    expect(mocks.issue).not.toHaveBeenCalled();
  });
  it("refuses another payment's prepared document", async () => {
    await expect(issueVisaChangeInvoice({ execute: mocks.execute } as unknown as PoolConnection, 7, 12, "quote-test", { ...prepared, document: { ...prepared.document, paymentId: 99 } })).rejects.toThrow("difference payment");
    expect(mocks.issue).not.toHaveBeenCalled();
  });
});
