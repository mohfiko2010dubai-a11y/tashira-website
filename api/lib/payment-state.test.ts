import { describe, expect, it } from "vitest";
import { paymentTransitionAllowed } from "./payment-state";

describe("Stripe event-time payment state", () => {
  it.each([10, 20, 30])("never downgrades a paid order for failure at %s", eventCreated => {
    expect(paymentTransitionAllowed({ paid: true, lastEventCreated: 20, eventCreated, target: "failed" })).toBe(false);
  });
  it("ignores an older event even if delivered later", () => {
    expect(paymentTransitionAllowed({ paid: false, lastEventCreated: 20, eventCreated: 10, target: "paid" })).toBe(false);
    expect(paymentTransitionAllowed({ paid: false, lastEventCreated: 20, eventCreated: 10, target: "failed" })).toBe(false);
  });
  it("allows a later verified success and a live Stripe confirmation", () => {
    expect(paymentTransitionAllowed({ paid: false, lastEventCreated: 20, eventCreated: 30, target: "paid" })).toBe(true);
    expect(paymentTransitionAllowed({ paid: false, lastEventCreated: 20, target: "paid" })).toBe(true);
  });
});
