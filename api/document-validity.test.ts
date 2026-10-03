import { describe, expect, it } from "vitest";
import { addCalendarMonths, assessDocumentValidity, isCalendarDate } from "../contracts/document-validity";

const policy = { passportMonths: 6, residenceMonths: 3, childUnderYears: 12 };
const today = "2026-10-04";
describe("document review facts, without a payment gate", () => {
  it("anchors both thresholds to entry, including past entry, never today", () => {
    const facts = assessDocumentValidity({ today, entryDate: "2026-09-15", passportExpiry: "2027-03-14", residenceExpiry: "2026-12-15" }, policy);
    expect(facts.passport).toMatchObject({ status: "BELOW", requiredUntil: "2027-03-15" });
    expect(facts.residence).toMatchObject({ status: "MEETS", requiredUntil: "2026-12-15", daysFromEntry: 91 });
    expect(facts).not.toHaveProperty("paymentBlocked");
  });
  it("does not fabricate entry when absent and asks only within the question window", () => {
    const facts = assessDocumentValidity({ today, passportExpiry: "2027-04-04" }, policy);
    expect(facts.needsTravelDate).toBe(true);
    expect(facts.passport.status).toBe("UNKNOWN");
    expect(facts.passport.requiredUntil).toBeNull();
    expect(assessDocumentValidity({ today, passportExpiry: "2027-04-05" }, policy).needsTravelDate).toBe(false);
  });
  it("includes expired documents in the travel question and preserves signed interval", () => {
    expect(assessDocumentValidity({ today, residenceExpiry: "2025-01-01" }, policy).needsTravelDate).toBe(true);
    expect(assessDocumentValidity({ today, entryDate: "2026-10-04", residenceExpiry: "2026-10-03" }, policy).residence.daysFromEntry).toBe(-1);
  });
  it("uses changed admin thresholds and the strict under-12 boundary", () => {
    const facts = assessDocumentValidity({ today, entryDate: "2026-10-04", dateOfBirth: "2014-10-04" }, { ...policy, passportMonths: 8 });
    expect(facts.passport.requiredUntil).toBe("2027-06-04");
    expect(facts.childReview).toBe("ADULT");
    expect(assessDocumentValidity({ today, entryDate: today, dateOfBirth: "2014-10-05" }, policy).childReview).toBe("CONFIRM_CHILD_RATE");
    expect(assessDocumentValidity({ today, entryDate: today }, policy).childReview).toBe("UNKNOWN");
    expect(assessDocumentValidity({ today, dateOfBirth: "2018-01-01" }, policy).childReview).toBe("CONFIRM_CHILD_RATE");
  });
  it("rejects impossible dates and clamps leap and month-end boundaries", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(addCalendarMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addCalendarMonths("2027-08-31", 6)).toBe("2028-02-29");
    expect(() => assessDocumentValidity({ today }, { ...policy, residenceMonths: 0 })).toThrow();
  });
});
