import { stripeSecretKey } from "./stripe-runtime";

export type StripeIntent = {
  id: string;
  client_secret: string | null;
  status: string;
  amount: number;
  amount_received: number;
  currency: string;
  metadata: Record<string, string>;
};

async function stripeRequest(url: string, init?: RequestInit): Promise<StripeIntent> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
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

export type SafeCardSummary = {
  brand: string;
  last4: string;
};

export function createSecurityDepositIntent(input: {
  amountCents: number;
  requestId: string;
  applicationReference: string;
  idempotencyKey: string;
}): Promise<StripeIntent> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Deposit amount must be positive cents");
  if (!/^[0-9a-f-]{36}$/u.test(input.requestId)) throw new Error("Invalid security-deposit request identifier");
  return stripeRequest("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: new URLSearchParams({
      amount: String(input.amountCents),
      currency: "aed",
      "automatic_payment_methods[enabled]": "true",
      "metadata[securityDepositRequestId]": input.requestId,
      "metadata[applicationReference]": input.applicationReference,
    }),
  });
}

export function verifySecurityDepositIntent(input: {
  intent: StripeIntent;
  paymentIntentId: string;
  requestId: string;
  expectedAmountCents: number;
}) {
  return input.intent.id === input.paymentIntentId
    && input.intent.status === "succeeded"
    && input.intent.currency === "aed"
    && input.intent.amount === input.expectedAmountCents
    && input.intent.amount_received === input.expectedAmountCents
    && input.intent.metadata.securityDepositRequestId === input.requestId;
}

export type StripeRefundResult = {
  id: string;
  payment_intent: string;
  amount: number;
  currency: string;
  status: "pending" | "requires_action" | "succeeded" | "failed" | "canceled";
};

export async function createStripeRefund(input: {
  paymentIntentId: string;
  amountCents: number;
  idempotencyKey: string;
  metadata: { refundCaseId: string; refundItemId: string; sourceType: string };
}): Promise<StripeRefundResult> {
  if (!/^pi_[a-zA-Z0-9_]+$/.test(input.paymentIntentId)) throw new Error("Invalid PaymentIntent identifier");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Refund amount must be positive cents");
  if (!/^refund-[0-9a-f-]{36}$/u.test(input.idempotencyKey)) throw new Error("Invalid refund idempotency key");

  const response = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: new URLSearchParams({
      payment_intent: input.paymentIntentId,
      amount: String(input.amountCents),
      "metadata[refundCaseId]": input.metadata.refundCaseId,
      "metadata[refundItemId]": input.metadata.refundItemId,
      "metadata[sourceType]": input.metadata.sourceType,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
    const category = data.error?.code || data.error?.type || `http_${response.status}`;
    throw new Error(`Stripe refund failed: ${category}`);
  }
  const refund = await response.json() as StripeRefundResult;
  if (!/^re_[a-zA-Z0-9_]+$/.test(refund.id) || refund.payment_intent !== input.paymentIntentId) {
    throw new Error("Stripe refund response could not be verified");
  }
  return refund;
}

export async function retrieveStripeRefund(refundId: string, expectedPaymentIntentId: string): Promise<StripeRefundResult> {
  if (!/^re_[a-zA-Z0-9_]+$/u.test(refundId)) throw new Error("Invalid Stripe refund identifier");
  if (!/^pi_[a-zA-Z0-9_]+$/u.test(expectedPaymentIntentId)) throw new Error("Invalid PaymentIntent identifier");
  const response = await fetch(`https://api.stripe.com/v1/refunds/${encodeURIComponent(refundId)}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey()}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: { code?: string; type?: string } };
    const category = data.error?.code || data.error?.type || `http_${response.status}`;
    throw new Error(`Stripe refund retrieval failed: ${category}`);
  }
  const refund = await response.json() as StripeRefundResult;
  if (refund.id !== refundId || refund.payment_intent !== expectedPaymentIntentId) {
    throw new Error("Stripe refund ownership could not be verified");
  }
  return refund;
}

export function formatSafeCardBrand(brand: string) {
  const normalized = brand.trim().toLocaleLowerCase("en-US");
  const known: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
    jcb: "JCB",
    unionpay: "UnionPay",
    diners: "Diners Club",
  };
  return known[normalized] || normalized.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-US"));
}

export async function retrieveStripeTestCardSummary(paymentIntentId: string): Promise<SafeCardSummary | null> {
  if (!/^pi_[a-zA-Z0-9_]+$/.test(paymentIntentId)) throw new Error("Invalid PaymentIntent identifier");
  const url = new URL(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`);
  url.searchParams.append("expand[]", "latest_charge");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${stripeSecretKey()}` } });
  if (!response.ok) return null;
  const intent = await response.json() as {
    latest_charge?: string | {
      payment_method_details?: { card?: { brand?: unknown; last4?: unknown } };
    };
  };
  const card = typeof intent.latest_charge === "object"
    ? intent.latest_charge.payment_method_details?.card
    : undefined;
  if (typeof card?.brand !== "string" || !/^[a-z0-9 _-]{1,30}$/iu.test(card.brand)) return null;
  if (typeof card.last4 !== "string" || !/^\d{4}$/u.test(card.last4)) return null;
  return { brand: formatSafeCardBrand(card.brand), last4: card.last4 };
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
