import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_TEMPLATES, renderTransactionalEmail } from './transactional-email';
import { verifyEmailSignature } from './email-webhook-signature';
import { createHmac, randomBytes } from 'node:crypto';
import { adminEmailActionUrl, isAdminEmail } from './email-audience';

beforeEach(() => vi.stubEnv('PUBLIC_APP_URL', 'https://staging.tashiraev.com'));
afterEach(() => vi.unstubAllEnvs());
describe('transactional mail in the customer language', () => {
  const variables = { replyText:'Synthetic reply <not markup>',referenceNumber: 'TSH-SYNTHETIC', invoiceNumber: 'TEST-INV-00001', amountPaid: '185.00', currency: 'USD', currentStatus: 'Paid', statusLabel: 'Paid', refundSummary: 'USD 50.00',
    invoiceUrl: `https://staging.tashiraev.com/invoice-download/TEST-INV-00001?expires=2000000000&signature=${'a'.repeat(43)}`,
    resumeUrl: 'https://staging.tashiraev.com/recover?token=synthetic', otp: '123456', expiresMinutes: '10',
    amount: '50.00', purpose: 'Synthetic', depositUrl: `https://staging.tashiraev.com/deposit/${'b'.repeat(43)}`, expiresAt: '2030-01-01',
    processingType: 'regular', originalProduct: '30 day', replacementProduct: '14 day', actionUrl: 'https://staging.tashiraev.com/en/track' };
  it.each(EMAIL_TEMPLATES)('%s has safe plaintext and HTML in both languages', template => {
    for (const language of ['ar','en']) {
      const result = renderTransactionalEmail(template, { ...variables, language });
      expect(result.subject).toContain(variables.referenceNumber);
      expect(result.body.length).toBeGreaterThan(60);
      const footer = language === 'ar' ? 'لن نطلب منك' : 'We never ask you';
      if (isAdminEmail(template)) {
        expect(result.html).not.toContain(footer);
        expect(result.body).not.toContain(footer);
        expect(result.html).not.toContain('/track');
        expect(result.html).toContain(`href="${adminEmailActionUrl(template, variables)}"`);
      } else {
        expect(result.html).toContain(footer);
        expect(result.body).toContain(footer);
      }
      expect(result.html).not.toContain('<img');
      expect(result.subject).not.toContain('Staging template test');
      expect(result.body).not.toMatch(/outside working hours|خارج ساعات العمل/);
      if (language === 'ar') { expect(result.html).toContain('dir="rtl"'); expect(result.subject).toMatch(/[\u0600-\u06ff]/); }
      if (template === 'PAYMENT_SUCCESS') expect(result.body).toContain('185.00 USD');
    }
  });
  it('does not allow Arabic rendering to bypass invoice URL authorization', () => {
    expect(() => renderTransactionalEmail('PAYMENT_SUCCESS', { ...variables, language: 'ar', invoiceUrl: 'https://evil.example/invoice' })).toThrow();
  });
  it.each(['en', 'ar'])('unpaid document completion requests payment without claiming receipt in %s', language => {
    const result = renderTransactionalEmail('DOCUMENTS_COMPLETE', { ...variables, language, paymentStatus: 'pending', actionUrl: 'https://staging.tashiraev.com/ar/pay/TSH-SYNTHETIC' });
    expect(result.body).toContain(language === 'ar' ? 'لم نستلم الدفع بعد' : 'Payment has not been received');
    expect(result.html).toContain('/ar/pay/TSH-SYNTHETIC');
    expect(result.body).not.toContain(language === 'ar' ? 'تم التحقق من الدفع' : 'Your payment was verified');
  });
  it.each(['en','ar'])('documents complete states the correct continuous service window in %s', language => {
    const regular = renderTransactionalEmail('DOCUMENTS_COMPLETE', { ...variables, language, processingType: 'regular' });
    const express = renderTransactionalEmail('DOCUMENTS_COMPLETE', { ...variables, language, processingType: 'express' });
    expect(regular.body).toContain('48');
    expect(express.body).toContain('24');
    expect(express.body).toContain(language === 'ar' ? 'رسم الاستعجال كاملًا' : 'express fee in full');
    expect(() => renderTransactionalEmail('DOCUMENTS_COMPLETE', { ...variables, processingType: '' })).toThrow();
  });
  it('uses the approved Arabic copy and named HTML links without remote images', () => {
    const result = renderTransactionalEmail('APPLICATION_RECEIVED', { ...variables, language: 'ar' });
    expect(result.body).toContain('يمكنك متابعة حالة طلبك ورفع مستنداتك من صفحة طلبك الآمنة');
    expect(result.html).toContain('>تابع طلبك</a>');
    expect(result.html).not.toMatch(/>https:\/\//);
    const invoice = renderTransactionalEmail('PAYMENT_SUCCESS', { ...variables, language: 'ar' });
    expect(invoice.html).toContain('>عرض الفاتورة</a>');
    expect(invoice.html).not.toMatch(/>https:\/\//);
  });
  it.each(['APPROVAL_PENDING', 'GUARANTEE_BREACHED', 'CONNECTION_BROKEN'] as const)('routes %s to the exact refund case despite a supplied customer URL', template => {
    const result = renderTransactionalEmail(template, { ...variables, refundCaseId: '00000000-0000-4000-8000-000000000042' });
    expect(result.html).toContain('href="https://staging.tashiraev.com/admin/approvals#refund-case-00000000-0000-4000-8000-000000000042"');
    expect(result.body).not.toContain('/track');
  });
  it('blocks an external action link and escapes untrusted strings', () => {
    expect(() => renderTransactionalEmail('REJECTED', { ...variables, actionUrl: 'https://evil.example' })).toThrow();
    expect(renderTransactionalEmail('DOCUMENTS_REQUIRED', { ...variables, documentList: '<script>bad</script>' }).html).not.toContain('<script>');
  });
});
describe('signed delivery receipts', () => {
  // Generate a disposable test key: no credential-shaped literal belongs in source.
  const raw = '{"event_type":"ping","data":{"success":true}}', key = randomBytes(32);
  const secret = `whsec_${key.toString('base64')}`;
  const signature = createHmac('sha256', key).update(`msg_synthetic.1731705121.${raw}`).digest('base64');
  const headers = () => new Headers({ 'svix-id': 'msg_synthetic', 'svix-timestamp': '1731705121', 'svix-signature': `v1,${signature}` });
  it('verifies a separately signed Svix-protocol fixture', () => expect(verifyEmailSignature(raw, headers(), secret, 1731705121000)).toBe('msg_synthetic'));
  it('rejects body tampering, stale timestamps and absent secrets', () => {
    expect(() => verifyEmailSignature(raw + ' ', headers(), secret, 1731705121000)).toThrow();
    expect(() => verifyEmailSignature(raw, headers(), secret, 1731706000000)).toThrow();
    expect(() => verifyEmailSignature(raw, headers(), '', 1731705121000)).toThrow();
  });
});
