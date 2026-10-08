import { describe, expect, it } from 'vitest';
import { formatFeeMinor } from './application-display';

describe('Stripe fee display uses the settlement currency unit', () => {
  it.each([
    [3600, 'AED', 36],
    [3600, 'USD', 36],
    [3600, 'JPY', 3600],
    [3600, 'KWD', 3.6],
    [0, 'AED', 0],
  ])('formats %i minor units in %s without changing their value', (minor, currency, major) => {
    expect(formatFeeMinor(minor, currency)).toBe(new Intl.NumberFormat('ar-AE', { style: 'currency', currency }).format(major));
  });
});
