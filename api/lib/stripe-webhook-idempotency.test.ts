import { describe, expect, it } from "vitest";
import { canProcessStripeWebhook } from "./stripe-webhook-idempotency-decision";

describe("Stripe webhook idempotency decisions", () => {
  const now = new Date("2026-08-11T12:00:00Z");

  it("processes new and previously failed events", () => {
    expect(canProcessStripeWebhook(null, null, now)).toBe(true);
    expect(canProcessStripeWebhook("failed", now, now)).toBe(true);
  });

  it("does not replay processed or actively processing events", () => {
    expect(canProcessStripeWebhook("processed", now, now)).toBe(false);
    expect(canProcessStripeWebhook("processing", new Date(now.getTime() - 60_000), now)).toBe(false);
  });

  it("recovers a processing claim after its lease expires", () => {
    expect(canProcessStripeWebhook("processing", new Date(now.getTime() - 301_000), now)).toBe(true);
  });
});
