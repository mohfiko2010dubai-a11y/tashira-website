import { describe, expect, it } from "vitest";
import { validateVisaRuleImport } from "./rule-import";

function fixture() {
  return {
    stableId: "SYNTHETIC_RULE_001",
    version: 1,
    status: "DRAFT",
    classification: "OFFICIAL",
    researchStatus: "VALIDATED",
    routeCode: "SYNTHETIC_ROUTE",
    profileCode: "SYNTHETIC_PROFILE",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveTo: null,
    source: {
      authority: "Synthetic Authority",
      title: "Synthetic rule fixture",
      url: "https://example.invalid/rules/1",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      fingerprintSha256: "a".repeat(64),
    },
    conditions: [{ field: "nationality", operator: "EQUALS", value: "SYNTHETIC" }],
    outcome: {
      eligibility: "ELIGIBLE",
      requirementCodes: ["SYNTHETIC_PASSPORT"],
      explanationCode: "SYNTHETIC_ELIGIBLE",
    },
  };
}

describe("visa rule import boundary", () => {
  it("accepts a reviewed DRAFT fixture without activating it", () => {
    expect(validateVisaRuleImport(fixture()).status).toBe("DRAFT");
  });

  it("rejects an active raw import", () => {
    expect(() => validateVisaRuleImport({ ...fixture(), status: "ACTIVE" })).toThrow();
  });

  it("requires HTTPS source evidence", () => {
    const value = fixture();
    value.source.url = "http://example.invalid/rules/1";
    expect(() => validateVisaRuleImport(value)).toThrow();
  });

  it("forces unresearched profiles to human review", () => {
    const value = fixture();
    value.researchStatus = "NOT_RESEARCHED";
    expect(() => validateVisaRuleImport(value)).toThrow(/human review/i);
  });

  it("accepts an unresolved profile only with a human-review outcome", () => {
    const value = fixture();
    value.researchStatus = "MANUAL_REVIEW_REQUIRED";
    value.outcome.eligibility = "HUMAN_REVIEW_REQUIRED";
    expect(validateVisaRuleImport(value).outcome.eligibility).toBe("HUMAN_REVIEW_REQUIRED");
  });

  it("rejects an invalid effective interval", () => {
    expect(() => validateVisaRuleImport({ ...fixture(), effectiveTo: "2025-12-31T00:00:00.000Z" })).toThrow();
  });
});
