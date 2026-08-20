import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("final payment success presentation", () => {
  it("uses secure invoice view and download endpoints in one shared experience", async () => {
    const source = await readFile(new URL("../../src/components/shared/PaymentSuccessExperience.tsx", import.meta.url), "utf8");
    expect(source).toContain("/invoices/${encodedInvoice}/view");
    expect(source).toContain("/invoices/${encodedInvoice}/download");
    expect(source).toContain("credentials: 'same-origin'");
    expect(source).toContain("URL.createObjectURL(invoicePdf)");
    expect(source).toContain("src={invoicePreviewUrl}");
    expect(source).toContain("Invoice Preview");
    expect(source).not.toContain("Invoice Summary");
    expect(source).toContain("fixed inset-0 z-[100]");
  });

  it("covers the home hero and clears the normal-flow success state on home exit", async () => {
    const [experience, paymentForm] = await Promise.all([
      readFile(new URL("../../src/components/shared/PaymentSuccessExperience.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../src/components/shared/StripePaymentForm.tsx", import.meta.url), "utf8"),
    ]);
    expect(experience).toContain("onBackHome?.()");
    expect(paymentForm).toContain("onBackHome={onClose}");
  });

  it("keeps explicit inline preview and attachment download dispositions", async () => {
    const server = await readFile(new URL("../boot.ts", import.meta.url), "utf8");
    expect(server).toContain('app.get("/invoices/:invoiceNumber/view"');
    expect(server).toContain('Content-Disposition", `inline; filename="${result.fileName}"`');
    expect(server).toContain('app.get("/invoices/:invoiceNumber/download"');
    expect(server).toContain('Content-Disposition", `attachment; filename="${result.fileName}"`');
    expect(server).toContain("authorizeInvoiceRequest(invoiceNumber, c.req.raw.headers)");
  });

  it("links paid tracking back to authoritative payment confirmation", async () => {
    const [success, tracking] = await Promise.all([
      readFile(new URL("../../src/components/shared/PaymentSuccessExperience.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../src/pages/Track.tsx", import.meta.url), "utf8"),
    ]);
    expect(success).toContain("from=payment-confirmation");
    expect(tracking).toContain("Back to Payment Confirmation");
    expect(tracking).toContain('application.paymentStatus === "paid"');
  });

  it("sources invoice identity from the lead applicant rather than email", async () => {
    const [helper, finalization, fallback] = await Promise.all([
      readFile(new URL("./invoice-customer-name.ts", import.meta.url), "utf8"),
      readFile(new URL("./payment-finalization.ts", import.meta.url), "utf8"),
      readFile(new URL("../boot.ts", import.meta.url), "utf8"),
    ]);
    expect(helper).toContain("applicants.fullName");
    expect(helper).toContain("applicants.applicantIndex");
    expect(helper).toContain("applicants.nationality");
    expect(helper).toContain("applicants.passportNumber");
    expect(helper).toContain("applicants.passportExpiry");
    expect(finalization).toContain("getCanonicalInvoiceCustomerIdentity(application.id)");
    expect(fallback).toContain("getCanonicalInvoiceCustomerIdentity(appRow.id)");
    expect(finalization).not.toContain('application.contactEmail.split("@")');
    expect(fallback).not.toContain('customerEmail.split("@")');
  });
});
