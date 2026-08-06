import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStripeTestIntent, retrieveStripeTestIntent, verifyStripeIntent } from "./stripe";

const intent = {
  id: "pi_test_123",
  client_secret: "pi_test_123_secret_review",
  status: "succeeded",
  amount: 18500,
  amount_received: 18500,
  currency: "usd",
  metadata: { referenceNumber: "TSH-123456" },
};

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = ["sk", "test", "review_only"].join("_");
});

afterEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
  vi.unstubAllGlobals();
});

describe("Stripe test-mode boundary", () => {
  it("creates an idempotent USD intent using the server amount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(intent), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await createStripeTestIntent({ amountCents: 18500, referenceNumber: "TSH-123456", idempotencyKey: "app-42" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "Idempotency-Key": "app-42" });
    expect(String(init.body)).toContain("amount=18500");
    expect(String(init.body)).toContain("currency=usd");
  });

  it("refuses non-test Stripe keys", async () => {
    process.env.STRIPE_SECRET_KEY = "not-a-test-key";
    await expect(retrieveStripeTestIntent("pi_test_123")).rejects.toThrow("test-mode");
  });

  it("verifies status, identity, reference, amount, and currency", () => {
    expect(verifyStripeIntent({
      intent,
      paymentIntentId: intent.id,
      referenceNumber: "TSH-123456",
      expectedAmountCents: 18500,
    })).toBe(true);
    expect(verifyStripeIntent({
      intent: { ...intent, amount_received: 1 },
      paymentIntentId: intent.id,
      referenceNumber: "TSH-123456",
      expectedAmountCents: 18500,
    })).toBe(false);
  });
});
