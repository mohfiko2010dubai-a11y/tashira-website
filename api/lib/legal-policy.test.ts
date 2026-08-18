import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ACCEPTED_POLICY_TYPES, TERMS_POLICY_EFFECTIVE_DATE, TERMS_POLICY_VERSION } from '@contracts/constants';
import enLegal from '../../src/i18n/locales/en/legal.json';
import arLegal from '../../src/i18n/locales/ar/legal-v2.json';

describe('launch legal policy bundle', () => {
  it('publishes complete English and Arabic policy content under an immutable version', () => {
    expect(TERMS_POLICY_VERSION).toBe('legal-bundle-2026-08-18-v1');
    expect(TERMS_POLICY_EFFECTIVE_DATE).toBe('2026-08-18');
    expect(ACCEPTED_POLICY_TYPES).toEqual(['TERMS', 'PRIVACY', 'REFUND_CANCELLATION']);
    for (const policy of [enLegal, arLegal]) {
      expect(policy.terms.content.length).toBeGreaterThan(2_000);
      expect(policy.privacy.content.length).toBeGreaterThan(1_500);
      expect(policy.refund.content.length).toBeGreaterThan(1_000);
      expect(policy.terms.content).toContain('admin@tashiraev.com');
      expect(policy.privacy.content).toContain('Stripe');
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
