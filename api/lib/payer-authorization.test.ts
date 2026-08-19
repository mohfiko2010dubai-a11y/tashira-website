import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { PAYER_AUTHORIZATION_VERSION } from "@contracts/payer-authorization";
import { payerAuthorizationEventId, validatePayerAuthorization } from "./payer-authorization-core";

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
    expect(invoice).not.toContain("payerName");
    expect(paymentSuccess).not.toContain("payerName");
    expect(resend).not.toContain("payerName");
    for (const source of [checkout, paymentApi, evidence]) {
      expect(source).not.toMatch(/fullCardNumber|cardCvc|cardExpiry|stripeIframe|keystroke|screenRecording/u);
    }
  });
});
