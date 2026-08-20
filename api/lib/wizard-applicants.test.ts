import { describe, expect, it } from "vitest";

import { assertCompleteApplicantSequence, assertRequiredApplicantDocuments } from "./wizard-applicants";

const applicant = (applicantIndex: number) => ({
  applicantIndex,
  fullName: `Applicant ${applicantIndex + 1}`,
  nationality: "Test",
  passportNumber: `TEST000${applicantIndex}`,
  passportExpiry: "2030-01-01",
  profession: "Tester",
  countryFrom: "Testland",
});

describe("wizard applicant sequence", () => {
  it("accepts a complete family and returns canonical index order", () => {
    expect(assertCompleteApplicantSequence([applicant(1), applicant(0)], 2).map((item) => item.applicantIndex))
      .toEqual([0, 1]);
  });

  it("rejects missing, duplicate, and out-of-range applicant slots", () => {
    expect(() => assertCompleteApplicantSequence([applicant(0)], 2)).toThrow("Expected 2 applicants");
    expect(() => assertCompleteApplicantSequence([applicant(0), applicant(0)], 2)).toThrow("unique and contiguous");
    expect(() => assertCompleteApplicantSequence([applicant(0)], 21)).toThrow("between 1 and 20");
  });

  it("never counts another applicant's or application-level documents", () => {
    const applicants = [{ id: 10, applicantIndex: 0 }, { id: 11, applicantIndex: 1 }];
    const applicantOneDocuments = [
      { applicantId: 10, documentType: "passport", uploadStatus: "uploaded" },
      { applicantId: 10, documentType: "passport", uploadStatus: "uploaded" },
      { applicantId: 10, documentType: "photo", uploadStatus: "uploaded" },
    ];
    expect(() => assertRequiredApplicantDocuments(applicants, [
      ...applicantOneDocuments,
      { applicantId: null, documentType: "passport", uploadStatus: "uploaded" },
      { applicantId: 10, documentType: "photo", uploadStatus: "uploaded" },
    ])).toThrow("Applicant 2 is missing required documents");
    expect(() => assertRequiredApplicantDocuments(applicants, [
      ...applicantOneDocuments,
      { applicantId: 11, documentType: "passport", uploadStatus: "uploaded" },
      { applicantId: 11, documentType: "passport", uploadStatus: "uploaded" },
      { applicantId: 11, documentType: "photo", uploadStatus: "uploaded" },
    ])).not.toThrow();
  });
});
