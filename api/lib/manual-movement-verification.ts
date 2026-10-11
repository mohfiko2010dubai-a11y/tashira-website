import { stripeRuntimeMode, stripeSecretKey } from './stripe-runtime';

type ExpectedMovement = { reference: string; direction: 'TOP_UP' | 'REFUND'; amountMinor: number; currency: string };
export type VerifiedManualMovement = { reference: string; paymentIntentId: string; amountMinor: number; currency: string; metadata: Record<string, string> };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Stripe movement evidence is unavailable');
  return value as Record<string, unknown>;
}

/** Only provider facts, never the amount typed by an operator, prove receipt. */
export function parseManualMovement(value: unknown, expected: ExpectedMovement, live: boolean): VerifiedManualMovement {
  const row = object(value);
  if (row.id !== expected.reference || (expected.direction === 'TOP_UP' || row.livemode !== undefined) && row.livemode !== live || row.status !== 'succeeded'
    || !Number.isSafeInteger(expected.amountMinor) || expected.amountMinor <= 0
    || row.amount !== expected.amountMinor || typeof row.currency !== 'string'
    || row.currency.toUpperCase() !== expected.currency.toUpperCase()) throw new Error('Stripe movement does not match the completed amount, currency or environment');
  if (expected.direction === 'TOP_UP' && row.amount_received !== expected.amountMinor) throw new Error('Stripe has not received the full difference');
  const paymentIntentId = expected.direction === 'TOP_UP' ? row.id : row.payment_intent;
  if (typeof paymentIntentId !== 'string' || !/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) throw new Error('Stripe movement has no payment intent');
  const metadata: Record<string, string> = {};
  if (row.metadata && typeof row.metadata === 'object') for (const [key, item] of Object.entries(row.metadata)) if (typeof item === 'string') metadata[key] = item;
  return { reference: expected.reference, paymentIntentId, amountMinor: expected.amountMinor, currency: row.currency.toUpperCase(), metadata };
}

async function retrieve(path: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey()}` }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Stripe movement verification failed (${response.status}); no settlement was approved`);
  return object(await response.json());
}

/** Read-only: approving a manual receipt must never initiate another charge/refund. */
export async function verifyManualMovement(expected: ExpectedMovement): Promise<VerifiedManualMovement> {
  let reference = expected.reference;
  if (expected.direction === 'TOP_UP' && /^ch_[A-Za-z0-9_]+$/.test(reference)) {
    const charge = await retrieve(`charges/${encodeURIComponent(reference)}`);
    if (charge.id !== reference || charge.paid !== true || charge.refunded === true || Number(charge.amount_refunded) !== 0
      || charge.amount !== expected.amountMinor || typeof charge.currency !== 'string' || charge.currency.toUpperCase() !== expected.currency.toUpperCase()
      || charge.livemode !== (stripeRuntimeMode() === 'LIVE') || typeof charge.payment_intent !== 'string') throw new Error('Stripe charge is not an available completed difference payment');
    reference = charge.payment_intent;
  }
  const pattern = expected.direction === 'TOP_UP' ? /^pi_[A-Za-z0-9_]+$/ : /^re_[A-Za-z0-9_]+$/;
  if (!pattern.test(reference)) throw new Error('Stripe reference does not match the movement direction');
  const value = await retrieve(`${expected.direction === 'TOP_UP' ? 'payment_intents' : 'refunds'}/${encodeURIComponent(reference)}${expected.direction === 'TOP_UP' ? '?expand[]=latest_charge' : ''}`);
  const movement = parseManualMovement(value, { ...expected, reference }, stripeRuntimeMode() === 'LIVE');
  if (expected.direction === 'TOP_UP') {
    const charge = object(value.latest_charge);
    if (charge.payment_intent !== movement.paymentIntentId || charge.paid !== true || charge.amount_refunded !== 0 || charge.disputed !== false) throw new Error('The difference charge has been refunded or disputed; review it before settlement');
  } else {
    const payment = await retrieve(`payment_intents/${encodeURIComponent(movement.paymentIntentId)}`);
    if (payment.id !== movement.paymentIntentId || payment.livemode !== (stripeRuntimeMode() === 'LIVE')) throw new Error('Refund payment environment does not match');
  }
  return { ...movement, reference: expected.reference };
}
