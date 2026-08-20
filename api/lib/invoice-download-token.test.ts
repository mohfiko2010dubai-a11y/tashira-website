import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInvoiceDownloadUrl, verifyInvoiceDownloadToken } from "./invoice-download-token";

describe("invoice download capability", () => {
  beforeEach(() => {
    process.env.STORAGE_URL_SECRET = "a-review-only-invoice-download-secret";
    process.env.PUBLIC_APP_URL = "https://staging.tashiraev.com";
  });

  afterEach(() => {
    delete process.env.STORAGE_URL_SECRET;
    delete process.env.PUBLIC_APP_URL;
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

  it("rejects tampered links and origins other than PUBLIC_APP_URL", () => {
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

  it("creates the same authorized capability for the configured production origin", () => {
    process.env.PUBLIC_APP_URL = "https://tashiraev.com";
    const url = new URL(createInvoiceDownloadUrl({
      baseUrl: "https://tashiraev.com",
      invoiceNumber: "INV-TSH-123456",
      referenceNumber: "TSH-123456",
      nowSeconds: 1_000,
    }));
    expect(url.origin).toBe("https://tashiraev.com");
    expect(verifyInvoiceDownloadToken({
      invoiceNumber: "INV-TSH-123456",
      referenceNumber: "TSH-123456",
      expiresValue: url.searchParams.get("expires") || "",
      providedSignature: url.searchParams.get("signature") || "",
      nowSeconds: 1_001,
    })).toBe(true);
  });
});
