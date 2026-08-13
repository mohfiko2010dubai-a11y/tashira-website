import { describe, expect, it } from "vitest";
import { checkoutPreflightDecision, completionPanelGroups } from "../../src/lib/checkout-preflight";

describe("checkout readiness preflight", () => {
  it("keeps incomplete applications outside all payment UI", () => {
    expect(checkoutPreflightDecision("INCOMPLETE")).toEqual({
      openPaymentUi: false,
      initializeStripe: false,
      createPaymentIntent: false,
      showCompletionPanel: true,
    });
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
