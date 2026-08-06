type StripeIntent = {
  id: string;
  client_secret: string | null;
  status: string;
  amount: number;
  amount_received: number;
  currency: string;
  metadata: Record<string, string>;
};

function stripeTestKey(): string {
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key.startsWith("sk_test_")) {
    throw new Error("Stripe test-mode secret key is not configured");
  }
  return key;
}

async function stripeRequest(url: string, init?: RequestInit): Promise<StripeIntent> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${stripeTestKey()}`,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(data.error?.message || "Stripe request failed");
  }
  return response.json() as Promise<StripeIntent>;
}

export function createStripeTestIntent(input: {
  amountCents: number;
  referenceNumber: string;
  idempotencyKey: string;
}): Promise<StripeIntent> {
  return stripeRequest("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: new URLSearchParams({
      amount: String(input.amountCents),
      currency: "usd",
      "automatic_payment_methods[enabled]": "true",
      "metadata[referenceNumber]": input.referenceNumber,
    }),
  });
}

export function retrieveStripeTestIntent(paymentIntentId: string): Promise<StripeIntent> {
  if (!/^pi_[a-zA-Z0-9_]+$/.test(paymentIntentId)) throw new Error("Invalid PaymentIntent identifier");
  return stripeRequest(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`);
}

export function verifyStripeIntent(input: {
  intent: StripeIntent;
  paymentIntentId: string;
  referenceNumber: string;
  expectedAmountCents: number;
}): boolean {
  return input.intent.id === input.paymentIntentId
    && input.intent.status === "succeeded"
    && input.intent.currency === "usd"
    && input.intent.amount === input.expectedAmountCents
    && input.intent.amount_received === input.expectedAmountCents
    && input.intent.metadata.referenceNumber === input.referenceNumber;
}
