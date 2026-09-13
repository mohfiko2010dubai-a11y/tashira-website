import { describe, expect, it, vi } from "vitest";
import { loadTripPurposes } from "./trip-purpose";

describe("saved trip purpose", () => {
  it("reads only valid purposes from the latest applicant profile in the owned application", async () => {
    const query = vi.fn(async () => [{ applicantId: 1, tripPurpose: "visiting_family" }, { applicantId: 2, tripPurpose: "transit" }, { applicantId: 3, tripPurpose: "invalid" }, { applicantId: 4, tripPurpose: null }]);
    expect([...await loadTripPurposes({ query }, 42)]).toEqual([[1, "visiting_family"], [2, "transit"]]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("e.application_id=?"), [42]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("MAX(latest.profile_version)"), [42]);
  });
});
