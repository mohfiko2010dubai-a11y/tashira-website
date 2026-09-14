import { describe, expect, it, vi } from "vitest";
import type { PoolConnection } from "mysql2/promise";
import type { Stripe, StripeCardElement } from '@stripe/stripe-js';
import { assertSafeIntentRetry, reserveCheckoutPayment } from './checkout-payment-attempt';
import { resumeCardPayment } from '../../src/lib/resume-card-payment';

describe('durable payment retry', () => {
  it('reuses a saved intent even after the Stripe idempotency retention window', () => {
    const old = { key: 'key', quoteId: 'quote', firstRequestedAt: new Date(0), intentId: 'pi_saved' };
    expect(() => assertSafeIntentRetry(old)).not.toThrow();
    expect(() => assertSafeIntentRetry({ ...old, intentId: null })).toThrow('avoid a duplicate charge');
    expect(() => assertSafeIntentRetry({ ...old, intentId: null, firstRequestedAt: new Date() })).not.toThrow();
  });
  it('persists a reservation once and reuses it when the prior Stripe response was lost', async () => {
    let row: Record<string, unknown> | undefined;
    let inserts = 0;
    const connection = { execute: vi.fn(async (sql: string, values: unknown[]) => {
      if (sql.startsWith('SELECT')) return [row ? [row] : [], []];
      inserts++;
      row = { idempotency_key: values[1], quote_id: values[2], first_requested_at: new Date(), stripe_payment_intent_id: values[3] };
      return [{ affectedRows: 1 }, []];
    }) } as unknown as PoolConnection;
    const first = await reserveCheckoutPayment(connection, 1, 'quote', null);
    const second = await reserveCheckoutPayment(connection, 1, 'quote', null);
    expect(second.key).toBe(first.key);
    expect(inserts).toBe(1);
  });
  it.each(['succeeded', 'processing'])('does not confirm or attach another card when %s', async status => {
    const retrievePaymentIntent = vi.fn().mockResolvedValue({ paymentIntent: { status } });
    const confirmCardPayment = vi.fn();
    await resumeCardPayment({ retrievePaymentIntent, confirmCardPayment } as unknown as Stripe,
      { status, clientSecret: 'test', paymentIntentId: 'pi_saved' }, {} as StripeCardElement, 'Test');
    expect(confirmCardPayment).not.toHaveBeenCalled();
    expect(retrievePaymentIntent).toHaveBeenCalledOnce();
  });
  it.each(['requires_action', 'requires_confirmation'])('resumes %s without replacing the payment method', async status => {
    const confirmCardPayment = vi.fn().mockResolvedValue({});
    await resumeCardPayment({ confirmCardPayment } as unknown as Stripe,
      { status, clientSecret: 'test', paymentIntentId: 'pi_saved' }, {} as StripeCardElement, 'Test');
    expect(confirmCardPayment).toHaveBeenCalledExactlyOnceWith('test');
  });
  it('retries a failed card on the same intent and refuses a canceled intent', async () => {
    const confirmCardPayment = vi.fn().mockResolvedValue({});
    const stripe = { confirmCardPayment } as unknown as Stripe;
    const intent = { status: 'requires_payment_method', clientSecret: 'saved_secret', paymentIntentId: 'pi_saved' };
    await resumeCardPayment(stripe, intent, {} as StripeCardElement, 'Test');
    expect(confirmCardPayment.mock.calls[0][0]).toBe('saved_secret');
    await expect(resumeCardPayment(stripe, { ...intent, status: 'canceled' }, {} as StripeCardElement, 'Test')).rejects.toThrow('canceled');
    expect(confirmCardPayment).toHaveBeenCalledOnce();
  });
});
