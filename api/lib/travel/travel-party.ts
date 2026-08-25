export type TravelArrangement = "TOGETHER" | "SEPARATELY";
export type TicketStatus = "NOT_BOOKED" | "RESERVED" | "CONFIRMED";
export type TicketDocumentType =
  | "OUTBOUND_TICKET"
  | "RETURN_TICKET"
  | "ONWARD_TICKET"
  | "ROUND_TRIP_TICKET"
  | "FAMILY_BOOKING";

export type TravelGroup = {
  id: string;
  applicationId: number;
  applicantIds: readonly number[];
  primaryTravellerId: number;
  accompanyingAdultId: number | null;
  arrangement: TravelArrangement;
  origin: string;
  destination: string;
  plannedArrivalDate: string;
  plannedDepartureDate: string | null;
  ticketStatus: TicketStatus;
};

export type SharedTravelDocument = {
  id: string;
  applicationId: number;
  type: TicketDocumentType;
  linkedApplicantIds: readonly number[];
};

export type TravelPartyValidation = {
  valid: boolean;
  errors: readonly string[];
};

function isoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function validateTravelGroup(group: TravelGroup): TravelPartyValidation {
  const applicants = new Set(group.applicantIds);
  const errors: string[] = [];
  if (applicants.size === 0) errors.push("TRAVEL_GROUP_HAS_NO_APPLICANTS");
  if (applicants.size !== group.applicantIds.length) errors.push("DUPLICATE_APPLICANT_IN_TRAVEL_GROUP");
  if (!applicants.has(group.primaryTravellerId)) errors.push("PRIMARY_TRAVELLER_NOT_IN_GROUP");
  if (group.accompanyingAdultId !== null && !applicants.has(group.accompanyingAdultId)) {
    errors.push("ACCOMPANYING_ADULT_NOT_IN_GROUP");
  }
  if (!isoDate(group.plannedArrivalDate)) errors.push("INVALID_ARRIVAL_DATE");
  if (group.plannedDepartureDate !== null && !isoDate(group.plannedDepartureDate)) errors.push("INVALID_DEPARTURE_DATE");
  if (group.plannedDepartureDate !== null && group.plannedDepartureDate < group.plannedArrivalDate) {
    errors.push("DEPARTURE_BEFORE_ARRIVAL");
  }
  return { valid: errors.length === 0, errors };
}

export function validateSharedTravelDocument(input: {
  document: SharedTravelDocument;
  groups: readonly TravelGroup[];
}): TravelPartyValidation {
  const caseApplicants = new Set(input.groups
    .filter((group) => group.applicationId === input.document.applicationId)
    .flatMap((group) => group.applicantIds));
  const linked = new Set(input.document.linkedApplicantIds);
  const errors: string[] = [];
  if (linked.size === 0) errors.push("DOCUMENT_HAS_NO_LINKED_APPLICANTS");
  if (linked.size !== input.document.linkedApplicantIds.length) errors.push("DUPLICATE_DOCUMENT_APPLICANT_LINK");
  if (input.document.linkedApplicantIds.some((id) => !caseApplicants.has(id))) {
    errors.push("CROSS_APPLICATION_DOCUMENT_LINK");
  }
  return { valid: errors.length === 0, errors };
}
