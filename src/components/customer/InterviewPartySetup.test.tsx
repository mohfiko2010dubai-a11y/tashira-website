import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InterviewPartySetup, type PartySetup } from "./InterviewPartySetup";

const setup: PartySetup = {
  applicationId: 9,
  applicants: [
    { applicantId: 11, applicantIndex: 0, fullName: "Synthetic Father", nationality: "EG", residenceCountry: "AE", profileVersion: 2 },
    { applicantId: 12, applicantIndex: 1, fullName: "Synthetic Child", nationality: "PK", residenceCountry: "QA", profileVersion: 4 },
  ],
  relationships: [{ relationshipEventId: "relationship-1", fromApplicantId: 11, toApplicantId: 12, relationship: "CHILD" }],
  travelGroups: [{ travelGroupId: "11111111-1111-4111-8111-111111111111", version: 3, reference: "Family trip",
    applicantIds: [11, 12], primaryTravellerId: 11, accompanyingAdultId: 11, arrangement: "TOGETHER", origin: "CAI",
    destination: "DXB", plannedArrivalDate: "2027-01-20", plannedDepartureDate: null, ticketStatus: "NOT_BOOKED" }],
  sharedDocuments: [{ documentId: 91, documentType: "FAMILY_BOOKING", applicantIds: [11] }],
  requirementReadiness: [],
};
const callback = vi.fn(async () => undefined);

describe("InterviewPartySetup", () => {
  it("renders server-owned applicant identities, relationships and travel membership", () => {
    const html = renderToStaticMarkup(<InterviewPartySetup setup={setup} onAddApplicant={callback} onEditApplicant={callback}
      onDefineRelationship={callback} onCreateTravelGroup={callback} onUpdateTravelGroup={callback} onLinkSharedDocument={callback} />);
    expect(html).toContain("Applicant 1: Synthetic Father");
    expect(html).toContain("Applicant 2: Synthetic Child");
    expect(html).toContain("CHILD");
    expect(html).toContain("Family trip");
    expect(html).toContain("2 applicant(s)");
    expect(html).toContain("FAMILY BOOKING");
    expect(html).toContain("Linked to 1 applicant(s)");
  });

  it("does not expose finance, Stripe or internal supplier fields", () => {
    const html = renderToStaticMarkup(<InterviewPartySetup setup={setup} onAddApplicant={callback} onEditApplicant={callback}
      onDefineRelationship={callback} onCreateTravelGroup={callback} onUpdateTravelGroup={callback} onLinkSharedDocument={callback} />);
    expect(html).not.toMatch(/supplier cost|internal cost|margin|profit|stripe|payment intent/i);
  });
});
