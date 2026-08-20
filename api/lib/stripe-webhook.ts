import { createHmac, timingSafeEqual } from "crypto";
import { stripeRuntimeMode, stripeWebhookSecret } from "./stripe-runtime";

export const SUPPORTED_STRIPE_WEBHOOK_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.requires_action",
] as const;

export function isSupportedStripeWebhookEvent(eventType: string): boolean {
  return (SUPPORTED_STRIPE_WEBHOOK_EVENTS as readonly string[]).includes(eventType);
}

export type StripeWebhookIntent = {
  id: string;
  status: string;
  livemode: boolean;
  metadata: Record<string, string>;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: StripeWebhookIntent };
};

export function verifyStripeWebhook(payload: string, signatureHeader: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300 || signatures.length === 0) {
    throw new Error("Invalid Stripe webhook signature");
  }

  const expected = createHmac("sha256", stripeWebhookSecret()).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const valid = signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const actualBuffer = Buffer.from(signature, "hex");
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  });
  if (!valid) throw new Error("Invalid Stripe webhook signature");

  const event = JSON.parse(payload) as StripeWebhookEvent;
  if (!event.id || !event.type || !event.data?.object?.id) throw new Error("Invalid Stripe webhook payload");
  const expectedLiveMode = stripeRuntimeMode() === "LIVE";
  if (event.livemode !== expectedLiveMode || event.data.object.livemode !== expectedLiveMode) {
    throw new Error("Stripe webhook event mode does not match the configured runtime");
  }
  return event;
}
