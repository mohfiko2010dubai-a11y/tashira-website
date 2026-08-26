import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./context";
import { createCustomerPrecheckRouter } from "./customer-precheck-router";
import type { EligibilityRule } from "./lib/eligibility/eligibility-engine";
import type { FeatureFlagRecord } from "./lib/feature-flags/feature-flags";

const rule: EligibilityRule = {
  id: "OFFICIAL-BASE", version: 1, routeCode: "UAE_VISIT", layer: "BASE_ROUTE", classification: "OFFICIAL",
  sourceAuthority: "Synthetic Authority", reason: "SUPPORTED", effectiveFrom: new Date("2026-01-01"), effectiveTo: null,
  conditions: [{ field: "nationality", operator: "EQUALS", value: "EG" }], eligibilityEffect: "ELIGIBLE",
  requiredDocuments: ["PASSPORT"], conditionalDocuments: [{ code: "RETURN_TICKET", reason: "When requested" }],
};
const enabled: FeatureFlagRecord = { flagKey: "CUSTOMER_PRECHECK", environment: "STAGING", enabled: true, scopeType: "GLOBAL", scopeReference: "" };
const context: TrpcContext = { req: new Request("https://staging.invalid/api/trpc"), resHeaders: new Headers(), isAdmin: false, customerApplicationReferences: new Set() };

function router(flags: readonly FeatureFlagRecord[] = [enabled], rules: readonly EligibilityRule[] = [rule]) {
  return createCustomerPrecheckRouter({
    flagContextForContext: async () => ({ environment: "STAGING" }), flagsForContext: async () => flags,
    activeRules: async () => rules, now: () => new Date("2026-08-26T00:00:00Z"),
  });
}

describe("customer pre-check runtime", () => {
  it("uses active evidence and never guarantees approval", async () => {
    const result = await router().createCaller(context).evaluate({ routeCode: "UAE_VISIT", nationality: "EG", ticketStatus: "NOT_BOOKED" });
    expect(result).toMatchObject({ outcome: "LIKELY_ELIGIBLE", sourceVerificationStatus: "VERIFIED" });
    expect(result.ticketRequirementCodes).toEqual(["RETURN_TICKET"]);
    expect(result.disclaimer).toContain("not a visa approval");
  });
  it("fails closed while the flag is off", async () => {
    await expect(router([]).createCaller(context).evaluate({ routeCode: "UAE_VISIT", nationality: "EG" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("returns not researched instead of guessing", async () => {
    const result = await router([enabled], []).createCaller(context).evaluate({ routeCode: "UNKNOWN", nationality: "XX" });
    expect(result).toMatchObject({ outcome: "HUMAN_REVIEW_REQUIRED", sourceVerificationStatus: "NOT_RESEARCHED" });
  });
});
