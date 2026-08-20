export type CompleteWizardApplicant = {
  applicantIndex: number;
  fullName: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  profession: string;
  countryFrom: string;
};

export function assertCompleteApplicantSequence(
  applicants: CompleteWizardApplicant[],
  applicantCount: number,
): CompleteWizardApplicant[] {
  if (!Number.isInteger(applicantCount) || applicantCount < 1 || applicantCount > 20) {
    throw new Error("Applicant count must be between 1 and 20");
  }
  if (applicants.length !== applicantCount) {
    throw new Error(`Expected ${applicantCount} applicants but received ${applicants.length}`);
  }

  const sorted = [...applicants].sort((a, b) => a.applicantIndex - b.applicantIndex);
  sorted.forEach((applicant, index) => {
    if (applicant.applicantIndex !== index) {
      throw new Error("Applicant indexes must be unique and contiguous from zero");
    }
  });
  return sorted;
}

export function assertRequiredApplicantDocuments(
  applicants: Array<{ id: number; applicantIndex: number }>,
  documents: Array<{
    applicantId: number | null;
    documentType: string;
    uploadStatus: string;
  }>,
): void {
  for (const applicant of applicants) {
    const ownedUploads = documents.filter((document) =>
      document.applicantId === applicant.id && document.uploadStatus === "uploaded");
    const passportCount = ownedUploads.filter((document) => document.documentType === "passport").length;
    const photoCount = ownedUploads.filter((document) => document.documentType === "photo").length;
    if (passportCount < 2 || photoCount < 1) {
      throw new Error(`Applicant ${applicant.applicantIndex + 1} is missing required documents`);
    }
  }
}
