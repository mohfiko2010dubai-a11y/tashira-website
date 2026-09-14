import { afterEach, expect, it, vi } from 'vitest';
import { EMAIL_TEMPLATES, renderTransactionalEmail } from './transactional-email';

afterEach(() => vi.unstubAllEnvs());
it('brands every transactional template with the same sized PNG and escapes plain text', () => {
  vi.stubEnv('PUBLIC_APP_URL', 'https://staging.tashiraev.com');
  const variables = {
    referenceNumber: 'TSH-TEST', invoiceNumber: 'INV-TEST', amountPaid: '185', currency: 'USD',
    currentStatus: 'Paid', statusLabel: 'Review <not approval>',
    invoiceUrl: 'https://staging.tashiraev.com/invoice-download/INV-TEST?expires=9999999999&signature=' + 'a'.repeat(43),
    resumeUrl: 'https://staging.tashiraev.com/recover?token=test', otp: '123456', expiresMinutes: '10',
    amount: '100', purpose: 'Test', depositUrl: 'https://staging.tashiraev.com/deposit/' + 'a'.repeat(43),
    expiresAt: '2030-01-01', refundSummary: 'Test refund',
  };
  for (const template of EMAIL_TEMPLATES) {
    const email = renderTransactionalEmail(template, variables);
    expect(email.html).toContain('/icons/mark-1024-transparent.png" width="64" height="64"');
    expect(email.html).toContain('alt="TASHIRA — UAE E-Visa Services"');
    expect(email.html).not.toContain('<svg');
    expect(email.html).not.toContain('<not approval>');
  }
});
