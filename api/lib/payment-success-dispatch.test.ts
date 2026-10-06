import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ record: vi.fn(), send: vi.fn(), values: vi.fn(), timeline: vi.fn() }));
vi.mock("./payment-email-record", () => ({ paymentEmailRecord: mocks.record }));
vi.mock("../queries/connection", () => ({ getDb: () => ({ insert: () => ({ values: mocks.values }) }) }));
vi.mock("./email-provider", () => ({ transactionalEmailProvider: () => ({ name: "test", send: mocks.send }) }));
vi.mock("./invoice-archive", () => ({ readArchivedInvoice: async () => Buffer.from("%PDF-synthetic") }));
vi.mock("./invoice-download-token", () => ({ createInvoiceDownloadUrl: () => "https://example.invalid/invoice" }));
vi.mock("./public-app-url", () => ({ publicAppOrigin: () => "https://example.invalid" }));
vi.mock("./application-timeline", () => ({ recordTimelineEvent: mocks.timeline }));
import { sendPaymentSuccessEmail } from "./payment-success-email";

const input = { applicationId: 7, paymentId: 12, recipient: "wrong@example.invalid", referenceNumber: "WRONG",
  invoiceNumber: "WRONG", amountPaid: 999, currency: "WRONG", invoicePdfPath: "WRONG" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.record.mockResolvedValue({ recipient: "owner@example.invalid", referenceNumber: "TSH-TEST", language: "ar",
    invoiceNumber: "TEST-INV-2", amountPaid: 30, currency: "usd", invoicePdfPath: "archive:TEST-INV-2", alreadySent: false });
  mocks.send.mockResolvedValue({ reference: "provider-test" });
});
describe("verified payment email dispatch", () => {
  it("ignores stale caller financial facts and recipient and records a payment-scoped receipt", async () => {
    expect(await sendPaymentSuccessEmail(input)).toEqual({ status: "SENT" });
    expect(mocks.record).toHaveBeenCalledWith(7, 12);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ recipient: "owner@example.invalid",
      idempotencyKey: "payment-success/7/12", variables: expect.objectContaining({ invoiceNumber: "TEST-INV-2",
        amountPaid: "30.00", currency: "USD", trackingUrl: "https://example.invalid/ar/track?ref=TSH-TEST" }) }));
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 7, sourceReference: "payment:12", status: "SENT" }));
  });
  it("does not send a confirmed replay", async () => {
    mocks.record.mockResolvedValue({ alreadySent: true });
    expect(await sendPaymentSuccessEmail(input)).toEqual({ status: "ALREADY_SENT" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("keeps a failed payment-specific email retryable", async () => {
    mocks.send.mockRejectedValue(new Error("Synthetic provider failure"));
    expect(await sendPaymentSuccessEmail(input)).toEqual({ status: "FAILED" });
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ sourceReference: "payment:12", status: "FAILED" }));
    mocks.send.mockResolvedValue({ reference: "provider-test" });
    expect(await sendPaymentSuccessEmail(input)).toEqual({ status: "SENT" });
    expect(mocks.send.mock.calls.map(([request]) => request.idempotencyKey)).toEqual(["payment-success/7/12", "payment-success/7/12"]);
  });
});
