import { describe, expect, it } from 'vitest';
import { formatFeeMinor, formatOperationDate } from './application-display';

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

it('labels absent dates and always shows operational deadlines in Dubai time', () => {
  expect(formatOperationDate(null)).toBe('غير مسجّل بعد');
  const instant = new Date('2026-10-05T23:00:00.000Z');
  expect(formatOperationDate(instant)).toBe(new Intl.DateTimeFormat('ar-AE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' }).format(instant) + ' (بتوقيت الإمارات)');
});
