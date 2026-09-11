import { describe, expect, it } from "vitest";
import { minimumPassportExpiry, validPassportExpiry } from "../../../contracts/traveller-details";
const now = new Date("2026-09-11T12:00:00Z");
describe("six calendar months of passport validity", () => {
  it("uses arrival when supplied and includes the exact boundary", () => {
    expect(minimumPassportExpiry("2026-10-15", now)).toBe("2027-04-15");
    expect(validPassportExpiry("2027-04-14", "2026-10-15", now)).toBe(false);
    expect(validPassportExpiry("2027-04-15", "2026-10-15", now)).toBe(true);
  });
  it("uses today for missing or past arrival dates", () => {
    expect(minimumPassportExpiry(null, now)).toBe("2027-03-11");
    expect(minimumPassportExpiry("2026-01-01", now)).toBe("2027-03-11");
  });
  it("clamps calendar month endings and rejects impossible dates", () => {
    expect(minimumPassportExpiry("2026-08-31", new Date("2026-01-01Z"))).toBe("2027-02-28");
    expect(validPassportExpiry("2027-02-30", null, now)).toBe(false);
  });
});

