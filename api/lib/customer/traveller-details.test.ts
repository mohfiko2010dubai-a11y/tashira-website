import { describe, expect, it } from "vitest";
import { assessDocumentValidity } from "../../../contracts/document-validity";
const policy = { passportMonths: 6, residenceMonths: 3, childUnderYears: 12 };
const review = (entryDate: string | null, passportExpiry: string) => assessDocumentValidity({ today: "2026-09-11", entryDate, passportExpiry }, policy).passport;
describe("passport review from entry", () => {
  it("includes the exact calendar-month boundary", () => {
    expect(review("2026-10-15", "2027-04-14").status).toBe("BELOW");
    expect(review("2026-10-15", "2027-04-15").status).toBe("MEETS");
  });
  it("never substitutes today for missing or past entry", () => {
    expect(review(null, "2027-01-01").requiredUntil).toBeNull();
    expect(review("2026-01-01", "2027-01-01").requiredUntil).toBe("2026-07-01");
  });
  it("handles month ends and impossible dates without a false approval", () => {
    expect(review("2026-08-31", "2027-02-28").status).toBe("MEETS");
    expect(review("2026-08-31", "2027-02-30").status).toBe("UNKNOWN");
  });
});
