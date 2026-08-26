import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UnifiedInterviewReviewPanel, type UnifiedInterviewReviewModel } from "./UnifiedInterviewReviewPanel";

const review: UnifiedInterviewReviewModel = {
  applicants: [
    { applicantId: 11, label: "Synthetic Father", relationship: "LEAD_APPLICANT", eligibilityState: "ELIGIBLE",
      requirements: [{ code: "FATHER_PASSPORT", label: "Father passport", state: "REQUIRED", classification: "OFFICIAL", reason: "Father only" }], warnings: [] },
    { applicantId: 12, label: "Synthetic Child", relationship: "CHILD", eligibilityState: "HUMAN_REVIEW_REQUIRED",
      requirements: [{ code: "CHILD_PHOTO", label: "Child photo", state: "REQUIRED", classification: "OFFICIAL", reason: "Child only" }], warnings: ["Guardian review required"] },
  ],
  travelGroups: [{ travelGroupId: "trip-a", label: "Trip A", applicantIds: [11, 12], plannedArrivalDate: "2027-01-20" }],
  sharedDocuments: [{ documentId: "ticket-a", type: "FAMILY_BOOKING", linkedApplicantIds: [11], missingApplicantIds: [12] }],
  schedules: [{ travelGroupId: "trip-a", state: "WAIT_UNTIL_WINDOW", plannedArrivalDate: "2027-01-20", targetSubmissionDate: "2026-12-20", explanation: "Submit in the verified window." }],
  blockingReasons: ["Child requires review"], manualReviewRequired: true,
};

describe("UnifiedInterviewReviewPanel", () => {
  it("keeps applicant requirements visibly isolated", () => {
    const html = renderToStaticMarkup(<UnifiedInterviewReviewPanel review={review} />);
    const father = html.slice(html.indexOf('data-applicant-id="11"'), html.indexOf('data-applicant-id="12"'));
    const child = html.slice(html.indexOf('data-applicant-id="12"'), html.indexOf("Travel party"));
    expect(father).toContain("Father passport"); expect(father).not.toContain("Child photo");
    expect(child).toContain("Child photo"); expect(child).not.toContain("Father passport");
  });

  it("shows travel, timing, shared-document gaps and manual review without financial data", () => {
    const html = renderToStaticMarkup(<UnifiedInterviewReviewPanel review={review} />);
    expect(html).toContain("Synthetic Father, Synthetic Child");
    expect(html).toContain("Submit in the verified window");
    expect(html).toContain("still needs linking for Synthetic Child");
    expect(html).toContain("A TASHIRA specialist must review this application");
    expect(html).not.toMatch(/supplier cost|margin|profit|stripe/i);
  });
});
