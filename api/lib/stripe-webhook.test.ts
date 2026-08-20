import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isSupportedStripeWebhookEvent, SUPPORTED_STRIPE_WEBHOOK_EVENTS, verifyStripeWebhook } from "./stripe-webhook";

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
    process.env.STRIPE_MODE = "TEST";
    process.env.VITE_STRIPE_PUBLISHABLE_KEY = "pk_test_review_only";
    process.env.STRIPE_SECRET_KEY = "sk_test_review_only";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_review_only";
  });

  afterEach(() => {
    delete process.env.STRIPE_MODE;
    delete process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("accepts a current signed test-mode event", () => {
    expect(verifyStripeWebhook(payload, signature(), timestamp).type).toBe("payment_intent.succeeded");
  });

  it("keeps the webhook event allowlist narrow", () => {
    expect(SUPPORTED_STRIPE_WEBHOOK_EVENTS).toEqual([
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "payment_intent.requires_action",
    ]);
    expect(isSupportedStripeWebhookEvent("charge.succeeded")).toBe(false);
  });

  it("rejects tampered and stale events", () => {
    expect(() => verifyStripeWebhook(`${payload} `, signature(), timestamp)).toThrow("signature");
    expect(() => verifyStripeWebhook(payload, signature(), timestamp + 301)).toThrow("signature");
  });

  it("accepts a correctly signed LIVE event only in LIVE mode", () => {
    process.env.STRIPE_MODE = "LIVE";
    process.env.VITE_STRIPE_PUBLISHABLE_KEY = "pk_live_review_only";
    process.env.STRIPE_SECRET_KEY = "sk_live_review_only";
    const livePayload = payload.replaceAll('"livemode":false', '"livemode":true');
    expect(verifyStripeWebhook(livePayload, signature(livePayload), timestamp).type).toBe("payment_intent.succeeded");
  });

  it("rejects LIVE events in TEST mode and TEST events in LIVE mode", () => {
    const livePayload = payload.replaceAll('"livemode":false', '"livemode":true');
    expect(() => verifyStripeWebhook(livePayload, signature(livePayload), timestamp)).toThrow("does not match");
    process.env.STRIPE_MODE = "LIVE";
    process.env.VITE_STRIPE_PUBLISHABLE_KEY = "pk_live_review_only";
    process.env.STRIPE_SECRET_KEY = "sk_live_review_only";
    expect(() => verifyStripeWebhook(payload, signature(), timestamp)).toThrow("does not match");
  });

  it("rejects a LIVE webhook signed with the wrong endpoint secret", () => {
    process.env.STRIPE_MODE = "LIVE";
    process.env.VITE_STRIPE_PUBLISHABLE_KEY = "pk_live_review_only";
    process.env.STRIPE_SECRET_KEY = "sk_live_review_only";
    const livePayload = payload.replaceAll('"livemode":false', '"livemode":true');
    const validSignature = signature(livePayload);
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_wrong_review_only";
    expect(() => verifyStripeWebhook(livePayload, validSignature, timestamp)).toThrow("signature");
  });
});
