import { describe, expect, it } from 'vitest';

import {
  buildChatbotPaymentPath,
  getChatbotVisaLabel,
  getChatbotVisaServiceCode,
  getChatbotApplicantResumeStep,
  parseChatbotResumeMetadata,
  upsertChatbotApplicant,
} from '@/lib/chatbot-application';

describe('chatbot application routing', () => {
  it('maps customer labels to canonical server pricing codes', () => {
    expect(getChatbotVisaServiceCode('14 Days')).toBe('14days-single');
    expect(getChatbotVisaServiceCode('30 Days Multiple')).toBe('30days-multiple');
    expect(getChatbotVisaServiceCode('unknown')).toBeUndefined();
  });

  it('builds the registered payment route safely', () => {
    expect(buildChatbotPaymentPath('TSH-123456')).toBe('/pay/TSH-123456');
    expect(buildChatbotPaymentPath('unsafe/reference')).toBe('/pay/unsafe%2Freference');
  });

  it('restores a display label from the canonical service code', () => {
    expect(getChatbotVisaLabel('30days-multiple')).toBe('30 Days Multiple');
    expect(getChatbotVisaLabel('unknown')).toBeUndefined();
  });

  it('keeps one canonical draft per applicant index', () => {
    const draft = (applicantIndex: number, applicantId: number) => ({
      applicantId,
      applicantIndex,
      fullName: `Applicant ${applicantIndex + 1}`,
      nationality: 'Test',
      passportNumber: `TEST00${applicantIndex}`,
      passportExpiry: '2030-01-01',
      profession: 'Tester',
      countryFrom: 'Testland',
    });
    expect(upsertChatbotApplicant([draft(0, 10), draft(1, 11)], draft(0, 12)).map((item) => item.applicantId))
      .toEqual([12, 11]);
  });

  it('stores only a validated reference and target count for resume', () => {
    expect(parseChatbotResumeMetadata('{"referenceNumber":"TSH-123456","applicantCount":3}'))
      .toEqual({ referenceNumber: 'TSH-123456', applicantCount: 3 });
    expect(parseChatbotResumeMetadata('{"referenceNumber":"../../etc","applicantCount":3}')).toBeUndefined();
    expect(parseChatbotResumeMetadata('{"referenceNumber":"TSH-123","applicantCount":21}')).toBeUndefined();
  });

  it('derives the next applicant step without storing PII in browser storage', () => {
    const completeApplicant = {
      fullName: 'Test Applicant',
      nationality: 'Test',
      passportNumber: 'TEST123',
      passportExpiry: '2030-01-01',
      profession: 'Tester',
      travelingFrom: 'Testland',
    };
    expect(getChatbotApplicantResumeStep({
      applicant: completeApplicant,
      isPrimary: false,
      arrivalDate: '2027-01-01',
      contactEmail: 'test@example.test',
      contactPhone: '+971500000000',
      passportUploads: 1,
      photoUploads: 0,
    })).toBe('upload_passport_cover');
    expect(getChatbotApplicantResumeStep({
      applicant: completeApplicant,
      isPrimary: true,
      arrivalDate: '2027-01-01',
      contactEmail: 'test@example.test',
      contactPhone: '+971500000000',
      passportUploads: 2,
      photoUploads: 1,
    })).toBe('complete');
  });
});
