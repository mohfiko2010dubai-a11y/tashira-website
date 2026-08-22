import { describe, expect, it } from "vitest";
import { refundOutcomeEmailIdempotencyKey } from "./email-idempotency";
import { renderTransactionalEmail } from "./transactional-email";

describe("refund outcome email", () => {
  it("uses one stable provider idempotency key per refund case", () => {
    expect(refundOutcomeEmailIdempotencyKey("case-id")).toBe("refund-case/case-id");
  });

  it("renders only safe refund facts and no payment-card data", () => {
    const email = renderTransactionalEmail("REFUND_COMPLETED", {
      referenceNumber: "TSH-123456",
      refundSummary: "AED 2450.00",
      statusLabel: "Refunded",
    });
    expect(email.subject).toBe("Refund completed — TSH-123456");
    expect(email.body).toContain("AED 2450.00");
    expect(email.body).toContain("Refunded");
    expect(email.body).not.toMatch(/card|passport|CVC|expiry/iu);
  });
});
