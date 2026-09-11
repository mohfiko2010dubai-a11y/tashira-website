import { describe, expect, it } from "vitest";
import { canVisitCheckout, checkoutPreflightDecision, completionPanelGroups, safeCheckoutErrorMessage } from "../../src/lib/checkout-preflight";

describe("checkout readiness preflight", () => {
  it("allows reaching the policy checkbox without allowing payment or hiding other blockers", () => {
    expect(canVisitCheckout({ applicants: [{ missing: [] }], applicationMissing: [{ code: "application.policy" }] })).toBe(true);
    expect(checkoutPreflightDecision("INCOMPLETE").createPaymentIntent).toBe(false);
    expect(canVisitCheckout({ applicants: [{ missing: [{ code: "document.PASSPORT" }] }], applicationMissing: [] })).toBe(false);
    expect(canVisitCheckout({ applicants: [{ missing: [] }], applicationMissing: [{ code: "application.valid_product" }] })).toBe(false);
    expect(canVisitCheckout(undefined)).toBe(false);
    expect(canVisitCheckout({ applicants: [], applicationMissing: [] })).toBe(false);
  });
  it("keeps incomplete applications outside all payment UI", () => {
    expect(checkoutPreflightDecision("INCOMPLETE")).toEqual({
      openPaymentUi: false,
      initializeStripe: false,
      createPaymentIntent: false,
      showCompletionPanel: true,
    });
  });

  it("does not expose the server readiness payload as a raw payment error", () => {
    const raw = new Error('{"code":"APPLICATION_INCOMPLETE","applicants":[{"applicantId":37}]}');
    const message = safeCheckoutErrorMessage(raw);

    expect(message).toBe("Your application is not ready for payment yet. Please complete the missing information and documents first.");
    expect(message).not.toContain("applicantId");
  });

  it("allows a complete application to mount payment normally without creating an intent during preflight", () => {
    expect(checkoutPreflightDecision("READY")).toEqual({
      openPaymentUi: true,
      initializeStripe: true,
      createPaymentIntent: false,
      showCompletionPanel: false,
    });
  });

  it("groups exact missing requirements outside payment UI by applicant", () => {
    expect(completionPanelGroups({
      applicationMissing: [],
      applicants: [
        { label: "Applicant 1", missing: [{ label: "Passport copy and cover" }, { label: "Personal photo" }] },
        { label: "Applicant 2", missing: [] },
      ],
    })).toEqual([{ heading: "Applicant 1", items: ["Passport copy and cover", "Personal photo"] }]);
  });
});
