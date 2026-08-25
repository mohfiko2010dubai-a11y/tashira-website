import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DynamicCustomerApplicationPlan } from "../../../api/lib/customer/dynamic-application-plan";
import DynamicApplicationReview from "./DynamicApplicationReview";

const plan: DynamicCustomerApplicationPlan = {
  applicationId: 1, mode: "FAMILY",
  applicants: [
    { applicantId: 1, displayLabel: "Father", relationship: "LEAD_APPLICANT", evaluationId: "e1", eligibilityState: "ELIGIBLE", questions: [], uploads: [{ code: "PASSPORT", label: "Passport", category: "IDENTITY", classification: "AUTHORITY_REQUIRED", state: "REQUIRED", reason: "Official" }], warnings: [], manualReviewRequired: false },
    { applicantId: 2, displayLabel: "Child 1", relationship: "CHILD", evaluationId: "e2", eligibilityState: "ELIGIBLE", questions: [{ code: "MINOR", prompt: "Who is travelling with this child?", answerType: "TEXT" }], uploads: [{ code: "CONSENT", label: "Parental consent", category: "RELATIONSHIP", classification: "MAY_BE_REQUIRED", state: "CONDITIONAL", reason: "Minor" }], warnings: [], manualReviewRequired: false },
  ],
  caseQuestions: [], travelGroups: [{ travelGroupId: "g1", label: "Trip A", applicantIds: [1, 2], plannedArrivalDate: "2026-12-20", plannedDepartureDate: null }],
  schedules: [], canContinueToReview: true, canContinueToPayment: true, blockingReasons: [],
};

describe("DynamicApplicationReview", () => {
  it("renders nothing while closed", () => expect(renderToStaticMarkup(<DynamicApplicationReview enabled={false} plan={plan} />)).toBe(""));
  it("labels each applicant and keeps requirement classifications visible", () => {
    const html = renderToStaticMarkup(<DynamicApplicationReview enabled plan={plan} />);
    expect(html).toContain("Father");
    expect(html).toContain("Child 1");
    expect(html).toContain("Required by authority");
    expect(html).toContain("May be required");
    expect(html).toContain("Trip A");
  });
});
