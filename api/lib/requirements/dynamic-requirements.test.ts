import { describe, expect, it } from "vitest";
import type { FamilyEvaluation } from "../family/family-engine";
import { buildDynamicRequirements, type RequirementCatalog } from "./dynamic-requirements";

const catalog: RequirementCatalog = {
  version: "synthetic-catalog-v1",
  documents: [
    { code: "PASSPORT", label: "Passport", category: "IDENTITY" },
    { code: "PARENT_CONSENT", label: "Parent consent", category: "RELATIONSHIP" },
  ],
  questions: [
    { code: "IS_MINOR", prompt: "Is the applicant under 18?", answerType: "BOOLEAN" },
  ],
};

const family: FamilyEvaluation = {
  applicationId: 1,
  finalEligibilityState: "ELIGIBLE",
  manualReviewReasons: [],
  members: [
    {
      applicantId: 11, evaluationId: "eval-11", ruleVersions: [{ ruleId: "A", version: 1 }], eligibilityState: "ELIGIBLE",
      requiredDocuments: [{ applicantId: 11, code: "PASSPORT", evaluationId: "eval-11" }],
      conditionalDocuments: [{
        applicantId: 11, code: "PARENT_CONSENT", reason: "Required for minors", evaluationId: "eval-11",
        when: { questionCode: "IS_MINOR", operator: "EQUALS", value: "YES" },
      }],
      warnings: [],
    },
    {
      applicantId: 12, evaluationId: "eval-12", ruleVersions: [{ ruleId: "B", version: 3 }], eligibilityState: "ELIGIBLE",
      requiredDocuments: [{ applicantId: 12, code: "PASSPORT", evaluationId: "eval-12" }],
      conditionalDocuments: [], warnings: [],
    },
  ],
};

describe("dynamic requirements", () => {
  it("asks only the applicant-specific unresolved conditional question", () => {
    const view = buildDynamicRequirements({ family, catalog, answers: {} });
    expect(view.applicants[0].questions.map((question) => question.code)).toEqual(["IS_MINOR"]);
    expect(view.applicants[1].questions).toEqual([]);
  });

  it("promotes a conditional document only for the matching applicant answer", () => {
    const view = buildDynamicRequirements({ family, catalog, answers: { 11: { IS_MINOR: "YES" }, 12: { IS_MINOR: "YES" } } });
    expect(view.applicants[0].documents).toContainEqual({
      code: "PARENT_CONSENT", label: "Parent consent", category: "RELATIONSHIP",
      state: "REQUIRED", reason: "Required for minors",
    });
    expect(view.applicants[1].documents.map((document) => document.code)).toEqual(["PASSPORT"]);
  });

  it("does not require a conditional document when the applicant answer does not match", () => {
    const view = buildDynamicRequirements({ family, catalog, answers: { 11: { IS_MINOR: "NO" } } });
    expect(view.applicants[0].documents.map((document) => document.code)).toEqual(["PASSPORT"]);
  });

  it("fails to manual review instead of inventing unknown catalog definitions", () => {
    const unknownFamily: FamilyEvaluation = {
      ...family,
      members: [{ ...family.members[0], requiredDocuments: [{ applicantId: 11, code: "UNKNOWN_DOC", evaluationId: "eval-11" }] }],
    };
    const applicant = buildDynamicRequirements({ family: unknownFamily, catalog, answers: {} }).applicants[0];
    expect(applicant.manualReviewRequired).toBe(true);
    expect(applicant.warnings).toContain("UNKNOWN_DOCUMENT_DEFINITION:UNKNOWN_DOC");
    expect(applicant.documents.find((document) => document.code === "UNKNOWN_DOC")?.label).toBeNull();
  });
});
