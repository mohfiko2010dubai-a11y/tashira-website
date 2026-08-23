import { describe, expect, it } from "vitest";
import { isOperationsFlagEnabled, type FeatureFlagRecord } from "./feature-flags";

const globalFlag: FeatureFlagRecord = {
  flagKey: "VISA_RULES_EVALUATION",
  environment: "STAGING",
  enabled: true,
  scopeType: "GLOBAL",
  scopeReference: "",
};

describe("Operations OS feature flags", () => {
  it("keeps the family engine closed unless explicitly enabled", () => {
    expect(isOperationsFlagEnabled("FAMILY_ENGINE", { environment: "STAGING" }, [])).toBe(false);
  });

  it("fails closed when a flag has no matching record", () => {
    expect(isOperationsFlagEnabled("VISA_RULES_EVALUATION", { environment: "STAGING" }, [])).toBe(false);
  });

  it("never applies a staging flag to Production", () => {
    expect(isOperationsFlagEnabled("VISA_RULES_EVALUATION", { environment: "PRODUCTION" }, [globalFlag])).toBe(false);
  });

  it("supports an explicit global enable", () => {
    expect(isOperationsFlagEnabled("VISA_RULES_EVALUATION", { environment: "STAGING" }, [globalFlag])).toBe(true);
  });

  it("allows a more specific application record to disable a global flag", () => {
    expect(isOperationsFlagEnabled("VISA_RULES_EVALUATION", {
      environment: "STAGING",
      applicationReference: "TSH-SYNTHETIC",
    }, [globalFlag, {
      ...globalFlag,
      enabled: false,
      scopeType: "APPLICATION",
      scopeReference: "TSH-SYNTHETIC",
    }])).toBe(false);
  });

  it("does not apply a team flag outside the actor teams", () => {
    expect(isOperationsFlagEnabled("VISA_RULES_EVALUATION", {
      environment: "STAGING",
      teamIds: new Set([9]),
    }, [{ ...globalFlag, scopeType: "TEAM", scopeReference: "8" }])).toBe(false);
  });
});
