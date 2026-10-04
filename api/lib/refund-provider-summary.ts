import { stripeSecretKey } from './stripe-runtime';

async function stripeGet(path: string): Promise<unknown> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${stripeSecretKey()}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Stripe information unavailable (${response.status}); refresh before executing.`);
  return response.json();
}
export async function stripeBalanceSummary() {
  const value = await stripeGet('balance');
  if (!value || typeof value !== 'object' || !('available' in value) || !Array.isArray(value.available)) throw new Error('Stripe balance response is invalid');
  return value.available.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || !('amount' in entry) || !('currency' in entry) || typeof entry.amount !== 'number' || typeof entry.currency !== 'string') throw new Error('Stripe balance currency is invalid');
    return { amountMinor: entry.amount, currency: entry.currency.toUpperCase() };
  });
}
export async function refundChargeSummary(intent: string) {
  if (!/^pi_[A-Za-z0-9_]+$/.test(intent)) throw new Error('Payment reference missing');
  const value = await stripeGet(`payment_intents/${intent}?expand[]=latest_charge`);
  if (!value || typeof value !== 'object' || !('id' in value) || value.id !== intent || !('latest_charge' in value)) throw new Error('Stripe payment reference mismatch');
  const charge = value.latest_charge;
  if (!charge || typeof charge !== 'object' || !('id' in charge) || typeof charge.id !== 'string' || !('amount' in charge) || typeof charge.amount !== 'number' || !('amount_refunded' in charge) || typeof charge.amount_refunded !== 'number' || !('currency' in charge) || typeof charge.currency !== 'string') throw new Error('Stripe charge is unavailable');
  return { chargeId: charge.id, dashboardUrl: `https://dashboard.stripe.com/${'livemode' in value && value.livemode === true ? '' : 'test/'}payments/${encodeURIComponent(intent)}`, paidMinor: charge.amount, refundedMinor: charge.amount_refunded, remainingMinor: charge.amount - charge.amount_refunded, currency: charge.currency.toUpperCase(), created: 'created' in charge && typeof charge.created === 'number' ? charge.created : null };
}
