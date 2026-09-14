import { afterEach, expect, it, vi } from 'vitest';
import { initializeGoogleAnalytics, trackFunnelEventOnce, trackVerifiedPaymentConversion } from './google-conversion';

afterEach(() => vi.unstubAllGlobals());
it('does not load a vendor or emit private application/recovery URLs even if gtag exists', () => {
  const gtag = vi.fn();
  const appendChild = vi.fn();
  vi.stubGlobal('window', { gtag, location: { href: 'https://staging.example/recover?token=synthetic-secret' } });
  vi.stubGlobal('document', { head: { appendChild } });
  expect(initializeGoogleAnalytics()).toBe(false);
  expect(trackFunnelEventOnce('begin_checkout', 'private-reference')).toBe(false);
  expect(trackVerifiedPaymentConversion({ paymentStatus: 'succeeded', transactionId: 'pi_test', value: 185, currency: 'USD' })).toBe(false);
  expect(gtag).not.toHaveBeenCalled();
  expect(appendChild).not.toHaveBeenCalled();
});
