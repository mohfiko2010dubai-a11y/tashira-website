import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyStripeWebhook } from "./stripe-webhook";

const timestamp = 1_800_000_000;
const payload = JSON.stringify({
  id: "evt_test_review",
  type: "payment_intent.succeeded",
  livemode: false,
  data: { object: { id: "pi_test_review", status: "succeeded", livemode: false, metadata: { referenceNumber: "TSH-REVIEW" } } },
});

function signature(body = payload) {
  const digest = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET!).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

describe("Stripe webhook verification", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_review_only";
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("accepts a current signed test-mode event", () => {
    expect(verifyStripeWebhook(payload, signature(), timestamp).type).toBe("payment_intent.succeeded");
  });

  it("rejects tampered and stale events", () => {
    expect(() => verifyStripeWebhook(`${payload} `, signature(), timestamp)).toThrow("signature");
    expect(() => verifyStripeWebhook(payload, signature(), timestamp + 301)).toThrow("signature");
  });

  it("rejects live-mode events", () => {
    const livePayload = payload.replace('"livemode":false', '"livemode":true');
    expect(() => verifyStripeWebhook(livePayload, signature(livePayload), timestamp)).toThrow("Live-mode");
  });
});
