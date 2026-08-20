import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { PAYER_AUTHORIZATION_VERSION } from "@contracts/payer-authorization";
import { payerAuthorizationEventId, payerEvidenceFromTimelineEvent, validatePayerAuthorization } from "./payer-authorization-core";
import { invoicePaymentDetailRows } from "./invoice-pdf";

const authorization = (overrides: Partial<Parameters<typeof validatePayerAuthorization>[0]> = {}) => ({
  payerName: "MOHAMMED ZAKY",
  payerRelationship: "Self" as const,
  authorizationAccepted: true,
  authorizationVersion: PAYER_AUTHORIZATION_VERSION,
  leadApplicantName: "MOHAMMED ZAKY",
  ...overrides,
});

describe("payer authorization evidence", () => {
  it("allows an applicant to pay for self and preserves authorization evidence", () => {
    expect(validatePayerAuthorization(authorization())).toMatchObject({
      payerName: "MOHAMMED ZAKY",
      payerRelationship: "Self",
      thirdParty: false,
    });
  });

  it.each([
    ["Family Member", "FATIMA AHMED", "MOHAMMED AHMED"],
    ["Friend", "FATIMA AHMED", "OMAR ALI"],
  ] as const)("allows an authorized %s without replacing the lead applicant", (relationship, leadApplicantName, payerName) => {
    expect(validatePayerAuthorization(authorization({ payerName, payerRelationship: relationship, leadApplicantName }))).toMatchObject({
      payerName,
      leadApplicantName,
      payerRelationship: relationship,
      thirdParty: true,
    });
  });

  it("blocks checkout before payment when authorization is not accepted", () => {
    expect(() => validatePayerAuthorization(authorization({ authorizationAccepted: false })))
      .toThrow("Payment authorization must be accepted");
  });

  it("requires an explicit relationship when payer and applicant differ", () => {
    expect(() => validatePayerAuthorization(authorization({ payerName: "ANOTHER PAYER", payerRelationship: "Self" })))
      .toThrow("Select the payer's relationship");
  });

  it("uses a stable immutable event ID across whitespace/case-only retries", () => {
    const first = payerAuthorizationEventId({ applicationId: 42, payerName: "Mohammed  Zaky", authorizationVersion: PAYER_AUTHORIZATION_VERSION });
    const retry = payerAuthorizationEventId({ applicationId: 42, payerName: "  MOHAMMED ZAKY ", authorizationVersion: PAYER_AUTHORIZATION_VERSION });
    expect(retry).toBe(first);
    expect(first).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("uses the same immutable payer evidence for invoice and chargeback presentation", () => {
    const evidence = payerEvidenceFromTimelineEvent({
      actorReference: "MOHAMMED AHMED HASSAN",
      sanitizedCategory: "Family Member",
      createdAt: new Date("2026-08-19T10:00:00.000Z"),
      policyVersion: PAYER_AUTHORIZATION_VERSION,
    });
    expect(evidence).not.toBeNull();
    const rows = invoicePaymentDetailRows({
      invoiceNumber: "INV-TSH-1", referenceNumber: "TSH-1", createdAt: "2026-08-19", customerName: "FATIMA AHMED",
      customerEmail: "approved@example.com", customerPhone: "+971500000000", passportNumber: "A123", passportExpiry: "2030-01-01",
      nationality: "Egyptian", visaType: "30-day", processingType: "regular", applicantCount: 2, unitPriceInBaseCurrency: 624,
      baseCurrency: "AED", exchangeRateToBase: 3.67, totalAmount: 340, currency: "USD", payerName: evidence!.payerName,
      payerRelationship: evidence!.relationship,
    });
    expect(rows).toContainEqual(["Paid by", evidence!.payerName]);
    expect(rows).toContainEqual(["Relationship", evidence!.relationship]);
  });

  it("keeps applicant, invoice, Stripe, and sensitive card data boundaries intact", async () => {
    const [checkout, paymentApi, evidence, admin, legal, invoice, paymentSuccess, resend] = await Promise.all([
      readFile(new URL("../../src/components/shared/PayerAuthorizationFields.tsx", import.meta.url), "utf8"),
      readFile(new URL("../payment-router.ts", import.meta.url), "utf8"),
      readFile(new URL("../timeline-router.ts", import.meta.url), "utf8"),
      readFile(new URL("../../src/pages/admin/AdminApplicationDetail.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../src/pages/Legal.tsx", import.meta.url), "utf8"),
      readFile(new URL("./invoice-pdf.ts", import.meta.url), "utf8"),
      readFile(new URL("../../src/components/shared/PaymentSuccessExperience.tsx", import.meta.url), "utf8"),
      readFile(new URL("./resend-email.ts", import.meta.url), "utf8"),
    ]);
    expect(checkout).toContain("Name on Card");
    expect(checkout).toContain("The payer and visa applicant may be different persons.");
    expect(paymentApi).toContain("recordPayerAuthorization");
    expect(paymentApi.indexOf("validatePayerAuthorization({")).toBeLessThan(paymentApi.indexOf("const paymentIntent = await createStripeTestIntent"));
    expect(evidence).toContain("payerAuthorization");
    expect(evidence).toContain("leadApplicant");
    expect(admin).toContain("PAYER_AUTHORIZATION_ACCEPTED");
    expect(admin).toContain("Accepted ✓");
    expect(legal).toContain("Payment may be made by an authorized third party");
    expect(invoice).toContain("payerName");
    expect(paymentSuccess).not.toContain("payerName");
    expect(resend).not.toContain("payerName");
    for (const source of [checkout, paymentApi, evidence]) {
      expect(source).not.toMatch(/fullCardNumber|cardCvc|cardExpiry|stripeIframe|keystroke|screenRecording/u);
    }
  });
});
