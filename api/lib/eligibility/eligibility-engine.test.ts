import { describe, expect, it } from "vitest";
import { evaluateEligibility, type EligibilityRule } from "./eligibility-engine";

const at = new Date("2026-06-01T00:00:00.000Z");

function rule(overrides: Partial<EligibilityRule> = {}): EligibilityRule {
  return {
    id: "BASE-1",
    version: 1,
    routeCode: "SYNTHETIC_ROUTE",
    layer: "BASE_ROUTE",
    classification: "OFFICIAL",
    sourceAuthority: "Synthetic Official Authority",
    reason: "Synthetic base route is eligible",
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null,
    conditions: [],
    eligibilityEffect: "ELIGIBLE",
    requiredDocuments: ["PASSPORT"],
    conditionalDocuments: [],
    ...overrides,
  };
}

const profile = {
  routeCode: "SYNTHETIC_ROUTE",
  attributes: { nationality: "SYNTHETIC_A", residence: "UAE", gccResident: true, age: 12, family: true },
};

describe("deterministic eligibility engine", () => {
  it("applies the highest matching official overlay deterministically", () => {
    const result = evaluateEligibility({ profile, evaluatedAt: at, rules: [
      rule(),
      rule({ id: "NAT-1", layer: "NATIONALITY_OVERLAY", conditions: [{ field: "nationality", operator: "EQUALS", value: "SYNTHETIC_A" }], reason: "Nationality requires review", eligibilityEffect: "HUMAN_REVIEW_REQUIRED" }),
      rule({ id: "MINOR-1", layer: "AGE_MINOR_OVERLAY", conditions: [{ field: "age", operator: "EQUALS", value: "12" }], reason: "Minor profile is eligible with consent", eligibilityEffect: "ELIGIBLE", requiredDocuments: ["PARENT_CONSENT"] }),
    ] });
    expect(result.finalEligibilityState).toBe("ELIGIBLE");
    expect(result.reason).toBe("Minor profile is eligible with consent");
    expect(result.requiredDocuments).toEqual(["PARENT_CONSENT", "PASSPORT"]);
    expect(result.matchedRuleIds).toEqual(["BASE-1", "NAT-1", "MINOR-1"]);
  });

  it("returns RULE_CONFLICT for conflicting official rules at one layer", () => {
    const result = evaluateEligibility({ profile, evaluatedAt: at, rules: [
      rule(),
      rule({ id: "NAT-ALLOW", layer: "NATIONALITY_OVERLAY", eligibilityEffect: "ELIGIBLE" }),
      rule({ id: "NAT-DENY", layer: "NATIONALITY_OVERLAY", eligibilityEffect: "INELIGIBLE", sourceAuthority: "Second Synthetic Authority" }),
    ] });
    expect(result.finalEligibilityState).toBe("RULE_CONFLICT");
    expect(result.manualReviewReason).toBe("AUTHORITATIVE_RULE_CONFLICT:NATIONALITY_OVERLAY");
    expect(result.sourceAuthorities).toEqual(["Second Synthetic Authority", "Synthetic Official Authority"]);
  });

  it("returns RULE_CONFLICT when two versions of one rule are effective", () => {
    const result = evaluateEligibility({ profile, evaluatedAt: at, rules: [
      rule(),
      rule({ id: "NAT-VERSIONED", version: 1, layer: "NATIONALITY_OVERLAY" }),
      rule({ id: "NAT-VERSIONED", version: 2, layer: "NATIONALITY_OVERLAY" }),
    ] });
    expect(result.finalEligibilityState).toBe("RULE_CONFLICT");
    expect(result.reason).toBe("OVERLAPPING_RULE_VERSIONS:NAT-VERSIONED");
  });

  it("never lets an operational rule override official eligibility", () => {
    const result = evaluateEligibility({ profile, evaluatedAt: at, rules: [
      rule(),
      rule({ id: "OPS-DENY", layer: "OPERATIONAL_OVERLAY", classification: "OPERATIONAL", eligibilityEffect: "INELIGIBLE", reason: "Operational capacity" }),
    ] });
    expect(result.finalEligibilityState).toBe("RULE_CONFLICT");
    expect(result.reason).toBe("NON_OFFICIAL_ELIGIBILITY_OVERRIDE:OPS-DENY");
  });

  it("allows operational rules to add documents without changing official eligibility", () => {
    const result = evaluateEligibility({ profile, evaluatedAt: at, rules: [
      rule(),
      rule({
        id: "OPS-DOC", layer: "OPERATIONAL_OVERLAY", classification: "OPERATIONAL",
        eligibilityEffect: "NO_CHANGE", reason: "Typing quality control",
        requiredDocuments: ["HIGH_RES_SCAN"],
        conditionalDocuments: [{ code: "TRANSLATION", reason: "When the document is not Arabic or English" }],
      }),
    ] });
    expect(result.finalEligibilityState).toBe("ELIGIBLE");
    expect(result.requiredDocuments).toEqual(["HIGH_RES_SCAN", "PASSPORT"]);
    expect(result.conditionalDocuments).toEqual([{ code: "TRANSLATION", reason: "When the document is not Arabic or English" }]);
  });

  it("returns HUMAN_REVIEW_REQUIRED for an unresolved route profile", () => {
    const result = evaluateEligibility({ profile, evaluatedAt: at, rules: [
      rule({ id: "OTHER", routeCode: "OTHER_ROUTE" }),
    ] });
    expect(result.finalEligibilityState).toBe("HUMAN_REVIEW_REQUIRED");
    expect(result.manualReviewReason).toBe("UNRESOLVED_PROFILE");
  });

  it("ignores expired and future rules", () => {
    const result = evaluateEligibility({ profile, evaluatedAt: at, rules: [
      rule(),
      rule({ id: "EXPIRED", layer: "FAMILY_OVERLAY", eligibilityEffect: "INELIGIBLE", effectiveTo: new Date("2026-05-01T00:00:00.000Z") }),
      rule({ id: "FUTURE", layer: "FAMILY_OVERLAY", eligibilityEffect: "INELIGIBLE", effectiveFrom: new Date("2026-07-01T00:00:00.000Z") }),
    ] });
    expect(result.finalEligibilityState).toBe("ELIGIBLE");
    expect(result.matchedRuleIds).toEqual(["BASE-1"]);
  });

  it("exposes rule versions, authority, reason and document evidence", () => {
    const result = evaluateEligibility({ profile, evaluatedAt: at, rules: [rule({ version: 3 })] });
    expect(result).toMatchObject({
      matchedRuleVersions: [{ ruleId: "BASE-1", version: 3 }],
      sourceAuthorities: ["Synthetic Official Authority"],
      reason: "Synthetic base route is eligible",
      finalEligibilityState: "ELIGIBLE",
      requiredDocuments: ["PASSPORT"],
      conditionalDocuments: [],
      manualReviewReason: null,
    });
  });

  it("returns identical evidence regardless of input order", () => {
    const rules = [
      rule(),
      rule({ id: "FAMILY-Z", layer: "FAMILY_OVERLAY", eligibilityEffect: "NO_CHANGE", requiredDocuments: ["RELATIONSHIP_PROOF"] }),
      rule({ id: "GCC-A", layer: "GCC_OVERLAY", eligibilityEffect: "ELIGIBLE", reason: "GCC overlay decision" }),
    ];
    const forward = evaluateEligibility({ profile, evaluatedAt: at, rules });
    const reverse = evaluateEligibility({ profile, evaluatedAt: at, rules: [...rules].reverse() });
    expect(reverse).toEqual(forward);
  });
});
