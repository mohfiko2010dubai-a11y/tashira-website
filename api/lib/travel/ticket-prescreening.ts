export type TicketPrescreenState = "PASS" | "WARNING" | "MISSING_APPLICANT" | "NAME_MISMATCH" | "UNREADABLE" | "MANUAL_REVIEW";

export type TicketExtraction = {
  passengerNames: readonly string[];
  origin: string | null;
  destination: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  airline: string | null;
  flightNumber: string | null;
  bookingReference: string | null;
  confidence: number;
};

function normalizeName(value: string): string {
  return value.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "").toLocaleUpperCase("en");
}

export function prescreenTicket(input: {
  extraction: TicketExtraction;
  linkedApplicants: readonly { applicantId: number; authoritativeName: string }[];
}): { state: TicketPrescreenState; reason: string; unmatchedApplicantIds: readonly number[]; confidence: number } {
  if (input.extraction.confidence < 0 || input.extraction.confidence > 1) {
    return { state: "MANUAL_REVIEW", reason: "INVALID_EXTRACTION_CONFIDENCE", unmatchedApplicantIds: [], confidence: 0 };
  }
  if (input.extraction.passengerNames.length === 0) {
    return { state: "UNREADABLE", reason: "NO_PASSENGER_NAMES_EXTRACTED", unmatchedApplicantIds: input.linkedApplicants.map((item) => item.applicantId), confidence: input.extraction.confidence };
  }
  const names = new Set(input.extraction.passengerNames.map(normalizeName));
  const unmatched = input.linkedApplicants.filter((applicant) => !names.has(normalizeName(applicant.authoritativeName))).map((applicant) => applicant.applicantId);
  if (unmatched.length === input.linkedApplicants.length) {
    return { state: "NAME_MISMATCH", reason: "NO_LINKED_APPLICANT_NAME_MATCHED", unmatchedApplicantIds: unmatched, confidence: input.extraction.confidence };
  }
  if (unmatched.length > 0) {
    return { state: "MISSING_APPLICANT", reason: "SOME_LINKED_APPLICANTS_NOT_FOUND", unmatchedApplicantIds: unmatched, confidence: input.extraction.confidence };
  }
  if (input.extraction.confidence < 0.8) {
    return { state: "WARNING", reason: "LOW_EXTRACTION_CONFIDENCE", unmatchedApplicantIds: [], confidence: input.extraction.confidence };
  }
  return { state: "PASS", reason: "ALL_LINKED_APPLICANTS_MATCHED", unmatchedApplicantIds: [], confidence: input.extraction.confidence };
}
