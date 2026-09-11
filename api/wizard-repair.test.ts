import { describe, expect, it } from 'vitest';
import { validStartContact } from '../src/lib/wizard-validation';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

describe('wizard contact validation', () => {
  it('rejects present but malformed contact details', () => {
    for (const [email, phone] of [['bad', '+971501234567'], ['x@example.com', 'call me'], ['x@example.com', '123'], ['x@example.com', '+1234567890123456']]) {
      expect(validStartContact(email, phone)).toBe(false);
    }
  });
  it('accepts trimmed email and formatted international phone', () => {
    expect(validStartContact(' user@example.com ', '+971 (50) 123-4567')).toBe(true);
  });
});

describe('wizard release regression boundaries', () => {
  it('uses the owned interview flow and never simulates payment success', async () => {
    const page = await readFile(new URL('../src/pages/UnifiedApplicationForm.tsx', import.meta.url), 'utf8');
    expect(page).toContain('<DynamicApplication key={referenceNumber}');
    expect(existsSync(new URL('../src/wizard/store.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../src/pages/wizard/Step5Review.tsx', import.meta.url))).toBe(false);
    const interview = await readFile(new URL('../src/pages/DynamicApplication.tsx', import.meta.url), 'utf8');
    expect(interview).toContain('canOpenCheckout && !state.review.manualReviewRequired');
    const payment = await readFile(new URL('./payment-router.ts', import.meta.url), 'utf8');
    expect(payment).toContain('if (readiness.status !== "READY")');
    expect(interview).toContain('applicantId: field.applicantId');
    expect(interview).toContain('<ApplicantDataForm applicant={applicant}');
    expect(interview).toContain('requirement.applicantId');
  });
});
