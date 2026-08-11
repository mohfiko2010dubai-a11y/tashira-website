import { describe, expect, it } from 'vitest';

import { buildChatbotPaymentPath, getChatbotVisaServiceCode } from '@/lib/chatbot-application';

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
});
