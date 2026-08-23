import { describe, expect, it } from "vitest";
import { evaluateEligibility, type EligibilityRule } from "./eligibility-engine";
import { createEvaluationEvidence, verifyEvaluationEvidence } from "./evaluation-evidence";

const evaluatedAt = new Date("2026-06-01T00:00:00.000Z");
const rule: EligibilityRule = {
  id: "SYNTHETIC-BASE",
  version: 2,
  routeCode: "SYNTHETIC_ROUTE",
  layer: "BASE_ROUTE",
  classification: "OFFICIAL",
  sourceAuthority: "Synthetic Authority",
  reason: "Synthetic eligibility fixture",
  effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  effectiveTo: null,
  conditions: [],
  eligibilityEffect: "ELIGIBLE",
  requiredDocuments: ["PASSPORT"],
  conditionalDocuments: [],
};

describe("eligibility evidence", () => {
  it("creates stable verifiable evidence without applicant profile fields", () => {
    const result = evaluateEligibility({
      profile: { routeCode: "SYNTHETIC_ROUTE", attributes: { passportNumber: "DO_NOT_PERSIST" } },
      rules: [rule],
      evaluatedAt,
    });
    const evidence = createEvaluationEvidence({
      evaluationId: "eval-1", applicationId: 10, applicantId: 20,
      selectedRoute: "SYNTHETIC_ROUTE", evaluatedAt, result,
    });
    expect(verifyEvaluationEvidence(evidence)).toBe(true);
    expect(JSON.stringify(evidence)).not.toContain("DO_NOT_PERSIST");
    expect(evidence.evidenceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence).toMatchObject({
      evaluationId: "eval-1",
      applicationId: 10,
      applicantId: 20,
      selectedRoute: "SYNTHETIC_ROUTE",
      eligibilityState: "ELIGIBLE",
      matchedRuleIds: ["SYNTHETIC-BASE"],
      matchedRuleVersions: [{ ruleId: "SYNTHETIC-BASE", version: 2 }],
      sourceAuthorities: ["Synthetic Authority"],
      evidenceIntegrityReference: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
  });

  it("detects evidence modification", () => {
    const result = evaluateEligibility({
      profile: { routeCode: "SYNTHETIC_ROUTE", attributes: {} }, rules: [rule], evaluatedAt,
    });
    const evidence = createEvaluationEvidence({
      evaluationId: "eval-1", applicationId: 10, applicantId: 20,
      selectedRoute: "SYNTHETIC_ROUTE", evaluatedAt, result,
    });
    expect(verifyEvaluationEvidence({ ...evidence, reason: "Modified" })).toBe(false);
  });
});
