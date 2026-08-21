import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validatedStripePublishableKey } from '../../src/lib/stripe-client-config';

describe('Stripe client configuration', () => {
  it.each([
    ['TEST', 'pk_test_51ReviewFixture', true],
    ['TEST', 'pk_live_51ReviewFixture', false],
    ['LIVE', 'pk_live_51ReviewFixture', true],
    ['LIVE', 'pk_test_51ReviewFixture', false],
    ['LIVE', '', false],
    ['LIVE', 'pk_live_placeholder', false],
    ['LIVE', 'pk_live_short', false],
    ['LIVE', ' pk_live_51ReviewFixture', false],
  ])('%s with a %s credential validates to %s', (mode, key, expected) => {
    expect(validatedStripePublishableKey(mode, key)).toBe(expected ? key : null);
  });

  it('rejects a missing or invalid explicit mode', () => {
    expect(validatedStripePublishableKey(undefined, 'pk_live_51ReviewFixture')).toBeNull();
    expect(validatedStripePublishableKey('INVALID', 'pk_live_51ReviewFixture')).toBeNull();
  });

  it('wires both checkout surfaces through mode-aware validation', async () => {
    const [paymentPage, sharedPaymentForm] = await Promise.all([
      readFile(new URL('../../src/pages/PaymentPage.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../../src/components/shared/StripePaymentForm.tsx', import.meta.url), 'utf8'),
    ]);

    for (const source of [paymentPage, sharedPaymentForm]) {
      expect(source).toContain('validatedStripePublishableKey');
      expect(source).not.toContain("startsWith('pk_test_')");
      expect(source).not.toContain('Stripe TEST payments are not configured');
    }
  });
});
