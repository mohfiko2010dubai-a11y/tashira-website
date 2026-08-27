import { authorizeAiAdvisoryTask } from "../ai/decision-boundary";

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

export type TicketApplicantMatch = {
  applicantId: number;
  authoritativeName: string;
  matchedPassengerName: string | null;
  state: "PASS" | "WARNING" | "NAME_MISMATCH" | "MISSING_APPLICANT" | "MANUAL_REVIEW";
  reason: string;
};

function normalizeName(value: string): string {
  return value.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "").toLocaleUpperCase("en");
}

export function prescreenTicket(input: {
  extraction: TicketExtraction;
  linkedApplicants: readonly { applicantId: number; authoritativeName: string }[];
}): { state: TicketPrescreenState; reason: string; unmatchedApplicantIds: readonly number[]; confidence: number } {
  authorizeAiAdvisoryTask("TICKET_PRESCREEN");
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

export function mapSharedTicketPassengers(input: {
  extraction: TicketExtraction;
  linkedApplicants: readonly { applicantId: number; authoritativeName: string }[];
}): readonly TicketApplicantMatch[] {
  authorizeAiAdvisoryTask("TICKET_PRESCREEN");
  if (new Set(input.linkedApplicants.map(({ applicantId }) => applicantId)).size !== input.linkedApplicants.length) {
    throw new Error("TICKET_APPLICANT_ID_DUPLICATE");
  }
  const passengers = input.extraction.passengerNames.map((rawName, index) => ({ rawName, normalized: normalizeName(rawName), index }));
  const applicantNames = input.linkedApplicants.map((applicant) => ({ ...applicant, normalized: normalizeName(applicant.authoritativeName) }));
  const duplicateAuthoritativeNames = new Set(applicantNames.filter((candidate, index, all) =>
    all.some((other, otherIndex) => otherIndex !== index && other.normalized === candidate.normalized)).map(({ normalized }) => normalized));
  const usedPassengerIndexes = new Set<number>();

  return applicantNames.map((applicant): TicketApplicantMatch => {
    if (!applicant.normalized || duplicateAuthoritativeNames.has(applicant.normalized)) {
      return { applicantId: applicant.applicantId, authoritativeName: applicant.authoritativeName, matchedPassengerName: null,
        state: "MANUAL_REVIEW", reason: duplicateAuthoritativeNames.has(applicant.normalized) ? "AMBIGUOUS_AUTHORITATIVE_NAME" : "AUTHORITATIVE_NAME_MISSING" };
    }
    const matches = passengers.filter((passenger) => passenger.normalized === applicant.normalized && !usedPassengerIndexes.has(passenger.index));
    if (matches.length !== 1) {
      return { applicantId: applicant.applicantId, authoritativeName: applicant.authoritativeName, matchedPassengerName: null,
        state: matches.length > 1 ? "MANUAL_REVIEW" : "MISSING_APPLICANT", reason: matches.length > 1 ? "AMBIGUOUS_PASSENGER_MATCH" : "PASSENGER_NOT_FOUND" };
    }
    const match = matches[0];
    if (!match) throw new Error("TICKET_PASSENGER_MATCH_INVARIANT");
    usedPassengerIndexes.add(match.index);
    if (input.extraction.confidence < 0 || input.extraction.confidence > 1) {
      return { applicantId: applicant.applicantId, authoritativeName: applicant.authoritativeName, matchedPassengerName: match.rawName,
        state: "MANUAL_REVIEW", reason: "INVALID_EXTRACTION_CONFIDENCE" };
    }
    return { applicantId: applicant.applicantId, authoritativeName: applicant.authoritativeName, matchedPassengerName: match.rawName,
      state: input.extraction.confidence < 0.8 ? "WARNING" : "PASS",
      reason: input.extraction.confidence < 0.8 ? "LOW_EXTRACTION_CONFIDENCE" : "AUTHORITATIVE_NAME_MATCHED" };
  });
}
