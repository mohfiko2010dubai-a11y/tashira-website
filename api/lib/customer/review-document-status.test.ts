import { describe, expect, it } from "vitest";
import { reviewDocumentStatus } from "../../../src/components/customer/review-document-status";

const evaluated = [{ code: "PASSPORT", label: "Passport copy", classification: "AUTHORITY_REQUIRED", state: "REQUIRED" }];
describe("review uses saved document status", () => {
  it("shows received uploads instead of the eligibility requirement and isolates travellers", () => {
    const saved = [{ applicantId: 1, requirementCode: "PASSPORT", state: "UPLOADED" }, { applicantId: 2, requirementCode: "PASSPORT", state: "MISSING" }];
    expect(reviewDocumentStatus(1, evaluated, saved)[0].state).toBe("UPLOADED");
    expect(reviewDocumentStatus(2, evaluated, saved)[0].state).toBe("MISSING");
  });
  it("includes owner-added pages and excludes superseded requirements", () => {
    const result = reviewDocumentStatus(1, evaluated, [{ applicantId: 1, requirementCode: "PASSPORT_SECOND_PAGE", state: "UPLOADED" }], true);
    expect(result).toEqual([{ code: "PASSPORT_SECOND_PAGE", label: "جواز السفر — الصفحة الثانية", classification: "TASHIRA_PROCESSING", state: "UPLOADED" }]);
    expect(reviewDocumentStatus(1, evaluated, [])).toEqual([]);
  });
  it("retains the legacy display when saved requirements are unavailable", () => {
    expect(reviewDocumentStatus(1, evaluated, undefined)).toEqual(evaluated);
  });
});
