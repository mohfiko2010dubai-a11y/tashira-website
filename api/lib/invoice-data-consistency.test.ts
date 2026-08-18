import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { canonicalInvoiceCustomerName } from "./invoice-customer-identity";

describe("canonical invoice customer identity", () => {
  it("uses the single applicant's submitted full name and normalizes whitespace only", () => {
    expect(canonicalInvoiceCustomerName([
      { applicantIndex: 0, fullName: "  MOHAMMED   ZAKY  " },
    ])).toBe("MOHAMMED ZAKY");
  });

  it("uses Applicant 1 for a family regardless of query order", () => {
    expect(canonicalInvoiceCustomerName([
      { applicantIndex: 2, fullName: "THIRD APPLICANT" },
      { applicantIndex: 1, fullName: "SECOND APPLICANT" },
      { applicantIndex: 0, fullName: "LEAD APPLICANT" },
    ])).toBe("LEAD APPLICANT");
  });

  it("never accepts a missing canonical applicant name", () => {
    expect(() => canonicalInvoiceCustomerName([])).toThrow("Canonical applicant name is unavailable");
    expect(() => canonicalInvoiceCustomerName([{ applicantIndex: 0, fullName: "   " }])).toThrow("Canonical applicant name is unavailable");
  });

  it("uses the canonical authorized server PDF for admin view and download", async () => {
    const buttons = await readFile(new URL("../../src/components/shared/InvoiceButton.tsx", import.meta.url), "utf8");
    expect(buttons).toContain("/invoices/${encodeURIComponent(props.invoiceNumber)}/view");
    expect(buttons).toContain("/invoices/${encodeURIComponent(props.invoiceNumber)}/download");
    expect(buttons).not.toContain("generateInvoicePDF");
    expect(buttons).not.toContain("'Customer'");
    expect(buttons).not.toContain("split('@')");
  });

  it("wraps long names and moves invoice rows to avoid overlap", async () => {
    const pdf = await readFile(new URL("./invoice-pdf.ts", import.meta.url), "utf8");
    expect(pdf).toContain("splitTextToSize(data.customerName, 82)");
    expect(pdf).toContain("Math.max(108, customerPhoneY + 12)");
  });
});
