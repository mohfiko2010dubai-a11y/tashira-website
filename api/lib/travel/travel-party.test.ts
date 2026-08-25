import { describe, expect, it } from "vitest";
import { validateSharedTravelDocument, validateTravelGroup, type TravelGroup } from "./travel-party";

const group = (overrides: Partial<TravelGroup> = {}): TravelGroup => ({
  id: "trip-a", applicationId: 10, applicantIds: [1, 2], primaryTravellerId: 1,
  accompanyingAdultId: 1, arrangement: "TOGETHER", origin: "CAI", destination: "DXB",
  plannedArrivalDate: "2026-12-01", plannedDepartureDate: "2026-12-10", ticketStatus: "CONFIRMED",
  ...overrides,
});

describe("travel party safety contract", () => {
  it("supports separate family travel groups without copying membership", () => {
    expect(validateTravelGroup(group()).valid).toBe(true);
    expect(validateTravelGroup(group({ id: "trip-b", applicantIds: [3, 4], primaryTravellerId: 3, accompanyingAdultId: 3 })).valid).toBe(true);
  });

  it("rejects an accompanying person outside the group", () => {
    expect(validateTravelGroup(group({ accompanyingAdultId: 99 })).errors).toContain("ACCOMPANYING_ADULT_NOT_IN_GROUP");
  });

  it("allows one family booking for several case applicants", () => {
    const result = validateSharedTravelDocument({
      document: { id: "doc", applicationId: 10, type: "FAMILY_BOOKING", linkedApplicantIds: [1, 2, 3] },
      groups: [group(), group({ id: "trip-b", applicantIds: [3], primaryTravellerId: 3, accompanyingAdultId: null })],
    });
    expect(result.valid).toBe(true);
  });

  it("fails closed on cross-application document ownership", () => {
    const result = validateSharedTravelDocument({
      document: { id: "doc", applicationId: 10, type: "RETURN_TICKET", linkedApplicantIds: [1, 99] },
      groups: [group()],
    });
    expect(result.errors).toContain("CROSS_APPLICATION_DOCUMENT_LINK");
  });
});
