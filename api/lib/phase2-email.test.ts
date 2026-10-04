import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_TEMPLATES, renderTransactionalEmail } from './transactional-email';
import { verifyEmailSignature } from './email-webhook-signature';

beforeEach(() => vi.stubEnv('PUBLIC_APP_URL', 'https://staging.tashiraev.com'));
afterEach(() => vi.unstubAllEnvs());
describe('transactional mail in the customer language', () => {
  const variables = { referenceNumber: 'TSH-SYNTHETIC', invoiceNumber: 'TEST-INV-00001', amountPaid: '185.00', currency: 'USD', currentStatus: 'Paid', statusLabel: 'Paid', refundSummary: 'USD 50.00',
    invoiceUrl: `https://staging.tashiraev.com/invoice-download/TEST-INV-00001?expires=2000000000&signature=${'a'.repeat(43)}`,
    resumeUrl: 'https://staging.tashiraev.com/recover?token=synthetic', otp: '123456', expiresMinutes: '10',
    amount: '50.00', purpose: 'Synthetic', depositUrl: `https://staging.tashiraev.com/deposit/${'b'.repeat(43)}`, expiresAt: '2030-01-01',
    originalProduct: '30 day', replacementProduct: '14 day', actionUrl: 'https://staging.tashiraev.com/en/track' };
  it.each(EMAIL_TEMPLATES)('%s has safe plaintext and HTML in both languages', template => {
    for (const language of ['ar','en']) {
      const result = renderTransactionalEmail(template, { ...variables, language });
      expect(result.subject).toContain(variables.referenceNumber);
      expect(result.body.length).toBeGreaterThan(60);
      expect(result.html).toContain(language === 'ar' ? 'لن نطلب منك' : 'We never ask you');
      expect(result.body).toContain(language === 'ar' ? 'لن نطلب منك' : 'We never ask you');
      expect(result.body).not.toMatch(/outside working hours|خارج ساعات العمل/);
      if (language === 'ar') { expect(result.html).toContain('dir="rtl"'); expect(result.subject).toMatch(/[\u0600-\u06ff]/); }
      if (template === 'PAYMENT_SUCCESS') expect(result.body).toContain('185.00 USD');
    }
  });
  it('does not allow Arabic rendering to bypass invoice URL authorization', () => {
    expect(() => renderTransactionalEmail('PAYMENT_SUCCESS', { ...variables, language: 'ar', invoiceUrl: 'https://evil.example/invoice' })).toThrow();
  });
  it('blocks an external action link and escapes untrusted strings', () => {
    expect(() => renderTransactionalEmail('REJECTED', { ...variables, actionUrl: 'https://evil.example' })).toThrow();
    expect(renderTransactionalEmail('DOCUMENTS_REQUIRED', { ...variables, documentList: '<script>bad</script>' }).html).not.toContain('<script>');
  });
});
describe('signed delivery receipts', () => {
  const raw = '{"event_type":"ping","data":{"success":true}}', secret = 'whsec_plJ3nmyCDGBKInavdOK15jsl';
  const headers = () => new Headers({ 'svix-id': 'msg_loFOjxBNrRLzqYUf', 'svix-timestamp': '1731705121', 'svix-signature': 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=' });
  it('matches the published Svix reference vector', () => expect(verifyEmailSignature(raw, headers(), secret, 1731705121000)).toBe('msg_loFOjxBNrRLzqYUf'));
  it('rejects body tampering, stale timestamps and absent secrets', () => {
    expect(() => verifyEmailSignature(raw + ' ', headers(), secret, 1731705121000)).toThrow();
    expect(() => verifyEmailSignature(raw, headers(), secret, 1731706000000)).toThrow();
    expect(() => verifyEmailSignature(raw, headers(), '', 1731705121000)).toThrow();
  });
});
