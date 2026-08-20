import { describe, expect, it } from "vitest";
import { paymentSuccessEmailIdempotencyKey } from "./email-idempotency";
import { renderTransactionalEmail } from "./transactional-email";

describe("payment success email", () => {
  it("uses one stable provider idempotency key per verified payment", () => {
    expect(paymentSuccessEmailIdempotencyKey({ applicationId: 37, paymentId: 91 }))
      .toBe("payment-success/37/91");
  });

  it("renders verified financial facts without claiming government submission", () => {
    const email = renderTransactionalEmail("PAYMENT_SUCCESS", {
      referenceNumber: "TSH-123456",
      invoiceNumber: "INV-TSH-123456",
      amountPaid: "170.00",
      currency: "USD",
      currentStatus: "Paid / Ready for Processing",
      invoiceUrl: "https://staging.tashiraev.com/invoice-download/INV-TSH-123456?expires=9999999999&signature=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      trackingUrl: "https://staging.tashiraev.com/track?ref=TSH-123456",
    });
    expect(email.body).toContain("170.00 USD");
    expect(email.body).toContain("Application: TSH-123456");
    expect(email.body).toContain("Invoice: INV-TSH-123456");
    expect(email.html).toContain("View / Download Invoice");
    expect(email.html).toContain("https://staging.tashiraev.com/invoice-download/INV-TSH-123456");
    expect(email.html).not.toContain("target=\"_blank\"");
    expect(email.body).toContain("does not mean government submission");
    expect(email.html).not.toContain("card");
  });

  it("rejects invoice links outside the authorized staging route", () => {
    const variables = {
      referenceNumber: "TSH-123456",
      invoiceNumber: "INV-TSH-123456",
      amountPaid: "170.00",
      currency: "USD",
      currentStatus: "Paid / Ready for Processing",
    };
    expect(() => renderTransactionalEmail("PAYMENT_SUCCESS", {
      ...variables,
      invoiceUrl: "https://example.com/invoice-download/INV-TSH-123456?expires=9999999999&signature=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })).toThrow("not an approved authorized staging URL");
    expect(() => renderTransactionalEmail("PAYMENT_SUCCESS", {
      ...variables,
      invoiceUrl: "https://staging.tashiraev.com/invoices/INV-TSH-123456.pdf?expires=9999999999&signature=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })).toThrow("not an approved authorized staging URL");
  });
});
