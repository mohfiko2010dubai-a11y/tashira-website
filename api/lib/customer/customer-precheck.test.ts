import { describe, expect, it } from "vitest";
import type { EligibilityRule } from "../eligibility/eligibility-engine";
import { runCustomerPrecheck } from "./customer-precheck";

const base: EligibilityRule = {
  id: "official-route", version: 3, routeCode: "UAE_VISIT", layer: "BASE_ROUTE", classification: "OFFICIAL",
  sourceAuthority: "Synthetic authority", reason: "Synthetic eligible route", effectiveFrom: new Date("2026-01-01"), effectiveTo: null,
  conditions: [{ field: "nationality", operator: "EQUALS", value: "SYNTHETIC" }], eligibilityEffect: "ELIGIBLE",
  requiredDocuments: ["PASSPORT"], conditionalDocuments: [{ code: "RETURN_TICKET", reason: "May be required" }],
};

describe("customer pre-check", () => {
  it("returns guidance with rule evidence and never claims approval", () => {
    const result = runCustomerPrecheck({
      profile: { routeCode: "UAE_VISIT", attributes: { nationality: "SYNTHETIC" } }, approvedPublicRules: [base], evaluatedAt: new Date("2026-08-25"),
    });
    expect(result.outcome).toBe("LIKELY_ELIGIBLE");
    expect(result.requiredDocumentCodes).toEqual(["PASSPORT"]);
    expect(result.conditionalDocumentCodes).toEqual(["RETURN_TICKET"]);
    expect(result.disclaimer).toContain("not a visa approval");
    expect(result.ruleEvidence).toEqual([{ ruleId: "official-route", version: 3 }]);
  });

  it("fails unresolved profiles to human review", () => {
    const result = runCustomerPrecheck({ profile: { routeCode: "UNKNOWN", attributes: {} }, approvedPublicRules: [], evaluatedAt: new Date("2026-08-25") });
    expect(result.outcome).toBe("HUMAN_REVIEW_REQUIRED");
    expect(result.warnings).toEqual(["UNRESOLVED_PROFILE"]);
  });
});
