import type { Stripe, StripeCardElement, PaymentIntentResult } from '@stripe/stripe-js';

/** Reuse the same intent; never attach a new card to an already submitted payment. */
export async function resumeCardPayment(stripe: Stripe, intent: { clientSecret: string; paymentIntentId: string; status: string },
  card: StripeCardElement, payerName: string): Promise<PaymentIntentResult> {
  if (intent.status === 'succeeded' || intent.status === 'processing') return stripe.retrievePaymentIntent(intent.clientSecret);
  if (intent.status === 'canceled') throw new Error('This payment was canceled. Contact support before starting another payment.');
  if (intent.status === 'requires_action' || intent.status === 'requires_confirmation') return stripe.confirmCardPayment(intent.clientSecret);
  if (intent.status !== 'requires_payment_method') throw new Error('Your payment is being verified. Refresh the page to check its status.');
  return stripe.confirmCardPayment(intent.clientSecret, { payment_method: { card, billing_details: { name: payerName.trim() } } });
}
