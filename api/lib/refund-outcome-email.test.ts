import { readFile } from "node:fs/promises";
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

  it("keeps email evidence append-only while deduplicating only successful sends", async () => {
    const source = await readFile(new URL("./refund-outcome-email.ts", import.meta.url), "utf8");
    const migration = await readFile(new URL("../../migrations/013_refund_email_append_only_idempotency.sql", import.meta.url), "utf8");
    expect(source).not.toContain("update(outboundEmailEvents)");
    expect(migration).toContain("CASE WHEN `email_status` = 'SENT'");
    expect(migration).toContain("outbound_email_template_sent_source_uq");
  });
});
