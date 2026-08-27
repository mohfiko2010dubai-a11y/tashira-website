import type { PartySetup, TravelInput } from "./InterviewPartySetup";

export function buildNewTravelGroupDraft(setup: PartySetup): TravelInput | null {
  const lead = setup.applicants[0];
  return lead ? { reference: "Main travel group", applicantIds: setup.applicants.map((item) => item.applicantId),
    primaryTravellerId: lead.applicantId, accompanyingAdultId: null, arrangement: "TOGETHER", origin: "", destination: "DXB",
    plannedArrivalDate: "", plannedDepartureDate: null, ticketStatus: "NOT_BOOKED" } : null;
}
