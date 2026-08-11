const VISA_SERVICE_CODES: Record<string, string> = {
  '14 Days': '14days-single',
  '30 Days': '30days-single',
  '30 Days Multiple': '30days-multiple',
  '60 Days': '60days-single',
  '60 Days Multiple': '60days-multiple',
  '90 Days': '90days-single',
  '96 Hours Transit': '96hours-transit',
};

export function getChatbotVisaServiceCode(label: string): string | undefined {
  return VISA_SERVICE_CODES[label];
}

export function buildChatbotPaymentPath(referenceNumber: string): string {
  return `/pay/${encodeURIComponent(referenceNumber)}`;
}
