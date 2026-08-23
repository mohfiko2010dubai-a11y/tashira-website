import { describe, expect, it } from "vitest";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import { evaluateFamilyReadinessBehindFlags } from "./family-readiness-service";

const members = [{
  applicantId: 1,
  evaluationId: "eval-1",
  eligibilityState: "ELIGIBLE" as const,
  routeCompatible: true,
  requirements: [],
}];

function enabled(flagKey: FeatureFlagRecord["flagKey"]): FeatureFlagRecord {
  return { flagKey, environment: "STAGING", enabled: true, scopeType: "GLOBAL", scopeReference: "" };
}

describe("family readiness feature boundary", () => {
  it("is closed by default and requires both family and requirements flags", () => {
    const context = { environment: "STAGING" as const };
    expect(evaluateFamilyReadinessBehindFlags({ context, flags: [], members })).toBeNull();
    expect(evaluateFamilyReadinessBehindFlags({ context, flags: [enabled("FAMILY_ENGINE")], members })).toBeNull();
  });

  it("evaluates only with both explicit same-environment flags", () => {
    const result = evaluateFamilyReadinessBehindFlags({
      context: { environment: "STAGING" },
      flags: [enabled("FAMILY_ENGINE"), enabled("DYNAMIC_REQUIREMENTS")],
      members,
    });
    expect(result?.family_readiness_state).toBe("READY_FOR_SUBMISSION");
  });

  it("does not let staging flags enable Production", () => {
    expect(evaluateFamilyReadinessBehindFlags({
      context: { environment: "PRODUCTION" },
      flags: [enabled("FAMILY_ENGINE"), enabled("DYNAMIC_REQUIREMENTS")],
      members,
    })).toBeNull();
  });
});
