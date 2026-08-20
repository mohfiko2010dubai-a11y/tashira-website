import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInvoiceDownloadUrl, verifyInvoiceDownloadToken } from "./invoice-download-token";

describe("invoice download capability", () => {
  beforeEach(() => {
    process.env.STORAGE_URL_SECRET = "a-review-only-invoice-download-secret";
  });

  afterEach(() => {
    delete process.env.STORAGE_URL_SECRET;
  });

  it("authorizes one invoice and application for one hour", () => {
    const url = new URL(createInvoiceDownloadUrl({
      baseUrl: "https://staging.tashiraev.com",
      invoiceNumber: "INV-TSH-123456",
      referenceNumber: "TSH-123456",
      nowSeconds: 1_000,
    }));
    const input = {
      invoiceNumber: "INV-TSH-123456",
      referenceNumber: "TSH-123456",
      expiresValue: url.searchParams.get("expires") || "",
      providedSignature: url.searchParams.get("signature") || "",
    };
    expect(url.pathname).toBe("/invoice-download/INV-TSH-123456");
    expect(verifyInvoiceDownloadToken({ ...input, nowSeconds: 1_001 })).toBe(true);
    expect(verifyInvoiceDownloadToken({ ...input, invoiceNumber: "INV-TSH-WRONG", nowSeconds: 1_001 })).toBe(false);
    expect(verifyInvoiceDownloadToken({ ...input, referenceNumber: "TSH-WRONG", nowSeconds: 1_001 })).toBe(false);
    expect(verifyInvoiceDownloadToken({ ...input, nowSeconds: 4_601 })).toBe(false);
  });

  it("rejects tampered and non-staging links", () => {
    expect(() => createInvoiceDownloadUrl({
      baseUrl: "https://example.com",
      invoiceNumber: "INV-TSH-123456",
      referenceNumber: "TSH-123456",
    })).toThrow("origin is not approved");
    expect(verifyInvoiceDownloadToken({
      invoiceNumber: "INV-TSH-123456",
      referenceNumber: "TSH-123456",
      expiresValue: "9999999999",
      providedSignature: "tampered",
    })).toBe(false);
  });
});
