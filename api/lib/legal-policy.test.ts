import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ACCEPTED_POLICY_TYPES, TERMS_POLICY_EFFECTIVE_DATE, TERMS_POLICY_VERSION } from '@contracts/constants';
import enLegal from '../../src/i18n/locales/en/legal.json';
import arLegal from '../../src/i18n/locales/ar/legal-v2.json';

describe('launch legal policy bundle', () => {
  it('publishes complete English and Arabic policy content under an immutable version', () => {
    expect(TERMS_POLICY_VERSION).toBe('legal-bundle-2026-08-19-v2');
    expect(TERMS_POLICY_EFFECTIVE_DATE).toBe('2026-08-19');
    expect(ACCEPTED_POLICY_TYPES).toEqual(['TERMS', 'PRIVACY', 'REFUND_CANCELLATION']);
    for (const policy of [enLegal, arLegal]) {
      expect(policy.terms.content.length).toBeGreaterThan(2_000);
      expect(policy.privacy.content.length).toBeGreaterThan(1_500);
      expect(policy.refund.content.length).toBeGreaterThan(1_000);
      expect(policy.terms.content).toContain('admin@tashiraev.com');
      expect(policy.privacy.content).toContain('Stripe');
    }
  });

  it('publishes equivalent transparent refund-deduction safeguards in English and Arabic', () => {
    expect(enLegal.terms.content).toContain('does not impose an arbitrary, undisclosed, open-ended or punitive refund fee');
    expect(enLegal.refund.content).toContain('The entire service fee is not automatically treated as earned before processing begins');
    expect(enLegal.refund.content).toContain('without a discretionary administrative penalty');
    expect(enLegal.refund.content).toContain('A refundable security deposit is a liability or guarantee, not a service fee');
    expect(enLegal.refund.content).toContain('final net refund');
    expect(arLegal.terms.content).toContain('لا تفرض تأشيرة رسوم استرداد تعسفية أو غير معلنة أو مفتوحة أو عقابية');
    expect(arLegal.refund.content).toContain('لا تعامل رسوم الخدمة كاملة تلقائياً كمكتسبة قبل بدء المعالجة');
    expect(arLegal.refund.content).toContain('دون غرامة إدارية تقديرية');
    expect(arLegal.refund.content).toContain('مبلغ التأمين القابل للاسترداد التزام أو ضمان وليس رسم خدمة');
    expect(arLegal.refund.content).toContain('وصافي الاسترداد النهائي');
    for (const policy of [enLegal, arLegal]) {
      expect(policy.refund.content).not.toContain('AED 1,000');
      expect(policy.refund.content).not.toContain('AED 880');
    }
  });

  it('requires one explicit acceptance control with all three policy links', () => {
    const root = process.cwd();
    const form = fs.readFileSync(path.join(root, 'src/sections/VisaApplicationForm.tsx'), 'utf8');
    const chatbot = fs.readFileSync(path.join(root, 'src/components/shared/ChatBot.tsx'), 'utf8');
    for (const source of [form, chatbot]) {
      expect(source).toContain('/terms');
      expect(source).toContain('/privacy');
      expect(source).toContain('/refund');
    }
    expect(chatbot).toContain('disabled={!wizard.acceptedTerms}');
    expect(chatbot).toContain('if (!w.acceptedTerms)');
  });
});
