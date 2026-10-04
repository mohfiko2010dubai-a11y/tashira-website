import { afterEach, expect, it, vi } from 'vitest';
import { EMAIL_TEMPLATES, renderTransactionalEmail } from './transactional-email';
import { isAdminEmail } from './email-audience';

afterEach(() => vi.unstubAllEnvs());
it('uses a text wordmark for customers and plain internal notices with images disabled', () => {
  vi.stubEnv('PUBLIC_APP_URL', 'https://staging.tashiraev.com');
  const variables = {
    referenceNumber: 'TSH-TEST', invoiceNumber: 'INV-TEST', amountPaid: '185', currency: 'USD',
    currentStatus: 'Paid', statusLabel: 'Review <not approval>',
    invoiceUrl: 'https://staging.tashiraev.com/invoice-download/INV-TEST?expires=9999999999&signature=' + 'a'.repeat(43),
    resumeUrl: 'https://staging.tashiraev.com/recover?token=test', otp: '123456', expiresMinutes: '10',
    amount: '100', purpose: 'Test', depositUrl: 'https://staging.tashiraev.com/deposit/' + 'a'.repeat(43),
    expiresAt: '2030-01-01', refundSummary: 'Test refund',
    originalProduct: '30 day', replacementProduct: '14 day', actionUrl: 'https://staging.tashiraev.com/en/track',
  };
  for (const template of EMAIL_TEMPLATES) {
    const email = renderTransactionalEmail(template, variables);
    expect(email.html).not.toContain('<img');
    if (!isAdminEmail(template)) expect(email.html).toContain('>TASHIRA</p>');
    else expect(email.html).not.toContain('>TASHIRA</p>');
    expect(email.html).not.toContain('<svg');
    expect(email.html).not.toContain('<not approval>');
  }
});
