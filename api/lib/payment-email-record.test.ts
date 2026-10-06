import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("./operations/mysql-query-client", () => ({ defaultOperationsPool: () => mocks }));
import { paymentEmailRecord } from "./payment-email-record";

beforeEach(() => vi.clearAllMocks());
describe("payment-specific customer notification", () => {
  it("loads only the succeeded payment's invoice and its application's recipient", async () => {
    mocks.execute.mockResolvedValue([[{ contact_email: "customer@example.invalid", reference_number: "TSH-TEST",
      preferred_language: "ar", invoice_number: "TEST-INV-2", amount: "30.00", currency: "usd",
      pdf_path: "archive:TEST-INV-2", already_sent: 0 }]]);
    expect(await paymentEmailRecord(8, 12)).toEqual({ recipient: "customer@example.invalid", referenceNumber: "TSH-TEST",
      language: "ar", invoiceNumber: "TEST-INV-2", amountPaid: 30, currency: "usd", invoicePdfPath: "archive:TEST-INV-2", alreadySent: false });
    const [sql, parameters] = mocks.execute.mock.calls[0];
    expect(parameters).toEqual([8, 12]);
    expect(sql).toContain("p.status='succeeded'");
    expect(sql).toContain("i.amount=p.amount");
    expect(sql).toContain("i.payment_id=p.id AND i.application_id=a.id");
    // Legacy unscoped confirmations cover only the original invoice, never a new difference payment.
    expect(sql).toContain("e.source_reference=CONCAT('payment:',p.id)");
    expect(sql).toContain("e.source_reference IS NULL AND i.id=(SELECT MIN(first_invoice.id)");
  });
  it.each([{ rows: [] }, { rows: [{}, {}] }])("refuses missing or ambiguous invoice ownership", async ({ rows }) => {
    mocks.execute.mockResolvedValue([rows]);
    await expect(paymentEmailRecord(8, 99)).rejects.toThrow("unique invoice");
  });
});
