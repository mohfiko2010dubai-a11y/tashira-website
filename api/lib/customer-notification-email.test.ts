import { describe, expect, it } from "vitest";
import { renderTransactionalEmail } from "./transactional-email";

describe("customer notification email templates", () => {
  it("renders a status update with the human-readable status", () => {
    const email = renderTransactionalEmail("STATUS_CHANGED", {
      referenceNumber: "TSH-UAT-123",
      statusLabel: "Under review by TASHIRA",
    });
    expect(email.subject).toContain("TSH-UAT-123");
    expect(email.body).toContain("Under review by TASHIRA");
  });

  it("renders the visa-issued notification", () => {
    expect(renderTransactionalEmail("VISA_ISSUED", { referenceNumber: "TSH-UAT-123" }).subject)
      .toContain("Visa issued");
  });

  it("includes the requested document and reason without requiring them for legacy callers", () => {
    const detailed = renderTransactionalEmail("DOCUMENTS_REQUIRED", {
      referenceNumber: "TSH-UAT-123",
      documentList: "Required document: passport. Reason: unreadable scan.",
    });
    expect(detailed.body).toContain("Required document: passport");
    expect(detailed.body).toContain("Reason: unreadable scan");
    expect(renderTransactionalEmail("DOCUMENTS_REQUIRED", { referenceNumber: "TSH-UAT-123" }).body)
      .not.toContain("Required document:");
  });

  it("rejects status notifications without a status label", () => {
    expect(() => renderTransactionalEmail("STATUS_CHANGED", { referenceNumber: "TSH-UAT-123" }))
      .toThrow(/statusLabel/);
  });
});
