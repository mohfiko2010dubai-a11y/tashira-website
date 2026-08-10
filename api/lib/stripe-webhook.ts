import { createHmac, timingSafeEqual } from "crypto";

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

function webhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret.startsWith("whsec_")) throw new Error("Stripe webhook secret is not configured");
  return secret;
}

export function verifyStripeWebhook(payload: string, signatureHeader: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300 || signatures.length === 0) {
    throw new Error("Invalid Stripe webhook signature");
  }

  const expected = createHmac("sha256", webhookSecret()).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const valid = signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const actualBuffer = Buffer.from(signature, "hex");
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  });
  if (!valid) throw new Error("Invalid Stripe webhook signature");

  const event = JSON.parse(payload) as StripeWebhookEvent;
  if (!event.id || !event.type || !event.data?.object?.id) throw new Error("Invalid Stripe webhook payload");
  if (event.livemode || event.data.object.livemode) throw new Error("Live-mode Stripe events are not accepted");
  return event;
}
