const VISA_SERVICE_CODES: Record<string, string> = {
  '14 Days': '14days-single',
  '30 Days': '30days-single',
  '30 Days Multiple': '30days-multiple',
  '60 Days': '60days-single',
  '60 Days Multiple': '60days-multiple',
  '90 Days': '90days-single',
  '96 Hours Transit': '96hours-transit',
};

export type ChatbotApplicant = {
  applicantId: number;
  applicantIndex: number;
  fullName: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  profession: string;
  countryFrom: string;
};

export type ChatbotResumeMetadata = {
  referenceNumber: string;
  applicantCount: number;
};

export type ChatbotApplicantResumeStep =
  | 'full_name'
  | 'nationality'
  | 'passport_number'
  | 'passport_expiry'
  | 'profession'
  | 'country_from'
  | 'arrival_date'
  | 'email'
  | 'phone'
  | 'upload_passport_copy'
  | 'upload_passport_cover'
  | 'upload_passport_photo'
  | 'complete';

export function getChatbotVisaServiceCode(label: string): string | undefined {
  return VISA_SERVICE_CODES[label];
}

export function getChatbotVisaLabel(serviceCode: string): string | undefined {
  return Object.entries(VISA_SERVICE_CODES).find(([, code]) => code === serviceCode)?.[0];
}

export function buildChatbotPaymentPath(referenceNumber: string): string {
  return `/pay/${encodeURIComponent(referenceNumber)}`;
}

export function upsertChatbotApplicant(
  applicants: ChatbotApplicant[],
  applicant: ChatbotApplicant,
): ChatbotApplicant[] {
  return [...applicants.filter((item) => item.applicantIndex !== applicant.applicantIndex), applicant]
    .sort((a, b) => a.applicantIndex - b.applicantIndex);
}

export function parseChatbotResumeMetadata(value: string | null): ChatbotResumeMetadata | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object'
      && parsed !== null
      && 'referenceNumber' in parsed
      && typeof parsed.referenceNumber === 'string'
      && /^TSH-[A-Z0-9-]+$/i.test(parsed.referenceNumber)
      && 'applicantCount' in parsed
      && typeof parsed.applicantCount === 'number'
      && Number.isInteger(parsed.applicantCount)
      && parsed.applicantCount >= 1
      && parsed.applicantCount <= 20
    ) {
      return { referenceNumber: parsed.referenceNumber, applicantCount: parsed.applicantCount };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function getChatbotApplicantResumeStep(input: {
  applicant?: {
    fullName: string | null;
    nationality: string | null;
    passportNumber: string | null;
    passportExpiry: string | null;
    profession: string | null;
    travelingFrom: string | null;
  };
  isPrimary: boolean;
  arrivalDate: string | null;
  contactEmail: string;
  contactPhone: string;
  passportUploads: number;
  photoUploads: number;
}): ChatbotApplicantResumeStep {
  if (!input.applicant?.fullName) return 'full_name';
  if (!input.applicant.nationality) return 'nationality';
  if (!input.applicant.passportNumber) return 'passport_number';
  if (!input.applicant.passportExpiry) return 'passport_expiry';
  if (!input.applicant.profession) return 'profession';
  if (!input.applicant.travelingFrom) return 'country_from';
  if (input.isPrimary && !input.arrivalDate) return 'arrival_date';
  if (input.isPrimary && !input.contactEmail) return 'email';
  if (input.isPrimary && !input.contactPhone) return 'phone';
  if (input.passportUploads === 0) return 'upload_passport_copy';
  if (input.passportUploads === 1) return 'upload_passport_cover';
  if (input.photoUploads === 0) return 'upload_passport_photo';
  return 'complete';
}
