import { describe, expect, it } from "vitest";
import { createEvaluationEvidence } from "../eligibility/evaluation-evidence";
import { evaluateEligibility, type EligibilityRule } from "../eligibility/eligibility-engine";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";
import { aggregateFamilyEvaluations } from "./family-engine";

function currentSnapshot(input: {
  repository: InMemoryEligibilitySnapshotRepository;
  applicantId: number;
  nationality: string;
  version: number;
  requiredDocument: string;
}) {
  const rule: EligibilityRule = {
    id: `RULE-${input.nationality}`,
    version: input.version,
    routeCode: "FAMILY_ROUTE",
    layer: "BASE_ROUTE",
    classification: "OFFICIAL",
    sourceAuthority: `Synthetic ${input.nationality} Authority`,
    reason: `${input.nationality} synthetic fixture`,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    conditions: [],
    eligibilityEffect: "ELIGIBLE",
    requiredDocuments: [input.requiredDocument],
    conditionalDocuments: [],
  };
  const evaluatedAt = new Date(`2026-06-${String(input.applicantId).padStart(2, "0")}T00:00:00.000Z`);
  const result = evaluateEligibility({
    profile: { routeCode: "FAMILY_ROUTE", attributes: { nationality: input.nationality } },
    rules: [rule],
    evaluatedAt,
  });
  const evaluationId = `eval-${input.applicantId}-v${input.version}`;
  input.repository.append(createEvaluationEvidence({
    evaluationId,
    applicationId: 1,
    applicantId: input.applicantId,
    selectedRoute: "FAMILY_ROUTE",
    evaluatedAt,
    result,
  }));
  input.repository.select({
    id: `selection-${input.applicantId}`,
    applicationId: 1,
    applicantId: input.applicantId,
    evaluationId,
    reason: "Synthetic approved evaluation",
    selectedBy: "staff:synthetic",
    selectedAt: evaluatedAt.toISOString(),
  });
}

describe("Family Engine", () => {
  it("preserves different rule versions for a mixed-nationality family", () => {
    const repository = new InMemoryEligibilitySnapshotRepository();
    currentSnapshot({ repository, applicantId: 11, nationality: "EGYPTIAN", version: 2, requiredDocument: "EGYPT_PASSPORT" });
    currentSnapshot({ repository, applicantId: 12, nationality: "PAKISTANI", version: 5, requiredDocument: "PAKISTAN_PASSPORT" });
    const family = aggregateFamilyEvaluations({
      applicationId: 1,
      snapshots: repository,
      members: [
        { applicantId: 11, relationship: "LEAD_APPLICANT" },
        { applicantId: 12, relationship: "SPOUSE" },
      ],
    });
    expect(family.members[0].ruleVersions).toEqual([{ ruleId: "RULE-EGYPTIAN", version: 2 }]);
    expect(family.members[1].ruleVersions).toEqual([{ ruleId: "RULE-PAKISTANI", version: 5 }]);
  });

  it("does not leak one applicant's document rules into another applicant", () => {
    const repository = new InMemoryEligibilitySnapshotRepository();
    currentSnapshot({ repository, applicantId: 11, nationality: "A", version: 1, requiredDocument: "DOCUMENT_A" });
    currentSnapshot({ repository, applicantId: 12, nationality: "B", version: 1, requiredDocument: "DOCUMENT_B" });
    const family = aggregateFamilyEvaluations({
      applicationId: 1, snapshots: repository,
      members: [{ applicantId: 12, relationship: "CHILD" }, { applicantId: 11, relationship: "LEAD_APPLICANT" }],
    });
    expect(family.members.find((member) => member.applicantId === 11)?.requiredDocuments)
      .toEqual([{ applicantId: 11, code: "DOCUMENT_A", evaluationId: "eval-11-v1" }]);
    expect(family.members.find((member) => member.applicantId === 12)?.requiredDocuments)
      .toEqual([{ applicantId: 12, code: "DOCUMENT_B", evaluationId: "eval-12-v1" }]);
  });

  it("requires a current evaluation for every family member", () => {
    const repository = new InMemoryEligibilitySnapshotRepository();
    currentSnapshot({ repository, applicantId: 11, nationality: "A", version: 1, requiredDocument: "A" });
    const family = aggregateFamilyEvaluations({
      applicationId: 1, snapshots: repository,
      members: [{ applicantId: 11, relationship: "LEAD_APPLICANT" }, { applicantId: 12, relationship: "CHILD" }],
    });
    expect(family.finalEligibilityState).toBe("HUMAN_REVIEW_REQUIRED");
    expect(family.manualReviewReasons).toContain("MISSING_CURRENT_EVALUATION:12");
  });

  it("rejects duplicate applicants and families without exactly one lead", () => {
    const repository = new InMemoryEligibilitySnapshotRepository();
    expect(() => aggregateFamilyEvaluations({
      applicationId: 1, snapshots: repository,
      members: [{ applicantId: 11, relationship: "LEAD_APPLICANT" }, { applicantId: 11, relationship: "CHILD" }],
    })).toThrow(/unique/i);
    expect(() => aggregateFamilyEvaluations({
      applicationId: 1, snapshots: repository,
      members: [{ applicantId: 11, relationship: "CHILD" }],
    })).toThrow(/exactly one lead/i);
  });
});
