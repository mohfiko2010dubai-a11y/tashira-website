export interface Applicant {
  fullName: string;
  nationality: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  profession: string;
}

export interface ApplicationFormData {
  residencyStatus: 'gcc-resident' | 'non-gcc-resident';
  gccSubType?: 'gcc-resident' | 'gcc-citizen-accompany';
  applicationType: 'single' | 'family';
  numberOfApplicants: number;
  visaType: string;
  processingType: 'regular' | 'express';
  contactName: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  applicants: Applicant[];
  countryOfDeparture: string;
  expectedArrivalDate: string;
  cityOfArrival: string;
  termsAccepted: boolean;
  passportCopies: File[];
  passportPhotos: File[];
  referenceNumber?: string;
  submittedAt?: string;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5;
