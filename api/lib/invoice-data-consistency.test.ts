import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { canonicalInvoiceCustomerIdentity, canonicalInvoiceCustomerName } from "./invoice-customer-identity";
import { generateInvoicePDF, invoicePaymentDetailRows, type InvoiceData } from "./invoice-pdf";

const lead = {
  applicantIndex: 0,
  fullName: "MOHAMMED ZAKY",
  nationality: "Egyptian",
  passportNumber: "A1111111",
  passportExpiry: "2030-04-12",
};

const invoice = (overrides: Partial<InvoiceData> = {}): InvoiceData => ({
  invoiceNumber: "INV-TSH-123456",
  referenceNumber: "TSH-123456",
  createdAt: "2026-08-19T00:00:00.000Z",
  customerName: lead.fullName,
  customerEmail: "approved@example.com",
  customerPhone: "+971500000000",
  nationality: lead.nationality,
  passportNumber: lead.passportNumber,
  passportExpiry: lead.passportExpiry,
  visaType: "30-day single entry",
  processingType: "regular",
  arrivalDate: "2026-09-01",
  applicantCount: 1,
  unitPriceInBaseCurrency: 624.24,
  baseCurrency: "AED",
  exchangeRateToBase: 3.672,
  totalAmount: 170,
  currency: "USD",
  payerName: lead.fullName,
  payerRelationship: "Self",
  ...overrides,
});

describe("canonical invoice customer identity", () => {
  it("uses the single applicant's authoritative identity and normalizes whitespace only", () => {
    expect(canonicalInvoiceCustomerIdentity([{ ...lead, fullName: "  MOHAMMED   ZAKY  " }])).toEqual({
      fullName: "MOHAMMED ZAKY",
      nationality: "Egyptian",
      passportNumber: "A1111111",
      passportExpiry: "2030-04-12",
    });
  });

  it("uses every identity field from Applicant 1 without mixing family members", () => {
    expect(canonicalInvoiceCustomerIdentity([
      { applicantIndex: 2, fullName: "NAME C", nationality: "C", passportNumber: "C333", passportExpiry: "2033-03-03" },
      { applicantIndex: 1, fullName: "NAME B", nationality: "B", passportNumber: "B222", passportExpiry: "2032-02-02" },
      { ...lead, fullName: "NAME A", nationality: "A", passportNumber: "A111", passportExpiry: "2031-01-01" },
    ])).toEqual({ fullName: "NAME A", nationality: "A", passportNumber: "A111", passportExpiry: "2031-01-01" });
  });

  it("never derives a missing canonical applicant name from contact data", () => {
    expect(() => canonicalInvoiceCustomerName([])).toThrow("Canonical applicant name is unavailable");
    expect(() => canonicalInvoiceCustomerName([{ ...lead, fullName: "   " }])).toThrow("Canonical applicant name is unavailable");
  });

  it("shows the recorded payer separately while preserving the lead applicant as BILL TO", () => {
    const data = invoice({ customerName: "FATIMA AHMED HASSAN", payerName: "MOHAMMED AHMED HASSAN", payerRelationship: "Family Member" });
    expect(data.customerName).toBe("FATIMA AHMED HASSAN");
    expect(invoicePaymentDetailRows(data)).toContainEqual(["Paid by", "MOHAMMED AHMED HASSAN"]);
    expect(invoicePaymentDetailRows(data)).toContainEqual(["Relationship", "Family Member"]);
  });

  it("shows the actual recorded payer name for self-payment", () => {
    expect(invoicePaymentDetailRows(invoice())).toContainEqual(["Paid by", "MOHAMMED ZAKY"]);
    expect(invoicePaymentDetailRows(invoice())).not.toContainEqual(["Relationship", "Self"]);
  });

  it("keeps the lead applicant as BILL TO for a family total", () => {
    const data = invoice({ applicantCount: 3, totalAmount: 340, payerName: "FAMILY PAYER", payerRelationship: "Sponsor" });
    expect(data.customerName).toBe(lead.fullName);
    expect(data.applicantCount).toBe(3);
    expect(data.totalAmount).toBe(340);
    expect(invoicePaymentDetailRows(data)).toContainEqual(["Paid by", "FAMILY PAYER"]);
  });

  it("renders only safe card metadata when both brand and last4 are available", () => {
    expect(invoicePaymentDetailRows(invoice({ cardBrand: "Visa", cardLast4: "4242" })))
      .toContainEqual(["Card", "Visa •••• 4242"]);
    expect(invoicePaymentDetailRows(invoice({ cardBrand: "Visa" }))).not.toEqual(expect.arrayContaining([expect.arrayContaining(["Card"])]));
    expect(JSON.stringify(invoicePaymentDetailRows(invoice({ cardBrand: "Visa", cardLast4: "4242" }))))
      .not.toMatch(/cvc|expir|4242\s*4242/u);
  });

  it.each([
    ["English single applicant", invoice()],
    ["Arabic single applicant", invoice({ customerName: "محمد زكري", nationality: "مصري" })],
    ["long Arabic name", invoice({ customerName: "محمد أحمد عبد الرحمن زكريا عبد الله حسن محمود", nationality: "مصري" })],
    ["mixed Arabic and English", invoice({ customerName: "محمد زكري MOHAMMED ZAKY", nationality: "مصري" })],
    ["three-applicant family total", invoice({ applicantCount: 3, unitPriceInBaseCurrency: 416.16, totalAmount: 340 })],
  ])("generates a non-empty canonical PDF for %s", (_caseName, data) => {
    const bytes = Buffer.from(generateInvoicePDF(data).output("arraybuffer"));
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(40_000);
  });

  it("uses the canonical authorized server PDF for preview, download, and admin", async () => {
    const buttons = await readFile(new URL("../../src/components/shared/InvoiceButton.tsx", import.meta.url), "utf8");
    expect(buttons).toContain("/invoices/${encodeURIComponent(props.invoiceNumber)}/view");
    expect(buttons).toContain("/invoices/${encodeURIComponent(props.invoiceNumber)}/download");
    expect(buttons).not.toContain("generateInvoicePDF");
    expect(buttons).not.toContain("split('@')");
  });

  it("preserves canonical inline and attachment endpoints", async () => {
    const server = await readFile(new URL("../boot.ts", import.meta.url), "utf8");
    expect(server).toContain('Content-Disposition", `inline; filename="${result.fileName}"`');
    expect(server).toContain('Content-Disposition", `attachment; filename="${result.fileName}"`');
    expect(server).toContain("authorizeInvoiceRequest(invoiceNumber, c.req.raw.headers)");
  });
});
