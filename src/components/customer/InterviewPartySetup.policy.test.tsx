import { describe, expect, it } from "vitest";
import type { PartySetup } from "./InterviewPartySetup";
import { buildNewTravelGroupDraft } from "./interview-party-draft";

const setup: PartySetup = { applicationId: 1, applicants: [
  { applicantId: 11, applicantIndex: 0, fullName: "Synthetic Lead", nationality: "EG", residenceCountry: "AE", profileVersion: 1 },
  { applicantId: 12, applicantIndex: 1, fullName: "Synthetic Child", nationality: "EG", residenceCountry: "AE", profileVersion: 1 },
], relationships: [], travelGroups: [], sharedDocuments: [], requirementReadiness: [] };

describe("Travel party accompaniment policy", () => {
  it("never assumes the lead applicant is the accompanying adult", () => {
    expect(buildNewTravelGroupDraft(setup)).toMatchObject({ primaryTravellerId: 11, applicantIds: [11, 12], accompanyingAdultId: null });
  });

  it("cannot build a travel-group draft without an owned lead applicant", () => {
    expect(buildNewTravelGroupDraft({ ...setup, applicants: [] })).toBeNull();
  });
});
