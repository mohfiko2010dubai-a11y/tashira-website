import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("professional customer UX invariants", () => {
  it("delegates assistant applications to the secure form and preserves owned edits", async () => {
    const [source, router] = await Promise.all([
      readFile(new URL("../../src/components/shared/ChatBot.tsx", import.meta.url), "utf8"),
      readFile(new URL("../wizard-router.ts", import.meta.url), "utf8"),
    ]);
    expect(source).toContain("assistantApplicationPath(language, reference)");
    expect(source).toContain("useProcessingQuotes(visa, count)");
    expect(source).toContain("assistantDocuments(");
    expect(source).not.toContain("startApplication.useMutation");
    expect(source).not.toContain("Math.round(wizard.totalAmount");
    expect(router).toContain("replaceDocument: applicationUploadQuery");
    expect(router).toContain('application.paymentStatus !== "pending"');
    expect(router).toContain("document.applicantId !== input.applicantId");
  });

  it("uses one authoritative paid-state success presentation", async () => {
    const [page, form, experience] = await Promise.all([
      readFile(new URL("../../src/pages/PaymentPage.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../src/components/shared/StripePaymentForm.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../src/components/shared/PaymentSuccessExperience.tsx", import.meta.url), "utf8"),
    ]);
    expect(page).toContain("<PaymentSuccessExperience");
    expect(form).toContain("<PaymentSuccessExperience");
    expect(experience).toContain("/invoices/${encodedInvoice}/download");
    expect(experience).toContain("Paid / Ready for Processing");
    expect(experience).toContain("resetPaymentSuccessViewport");
  });
});
