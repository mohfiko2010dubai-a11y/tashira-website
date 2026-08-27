import { describe, expect, it } from "vitest";
import { evaluatePassportProfileTransition } from "./passport-profile-governance";

describe("Passport Profile governance", () => {
  it("enforces separated proposal, review and activation permissions", () => {
    expect(evaluatePassportProfileTransition({ current: "DRAFT", action: "SUBMIT_FOR_REVIEW", actorPermissions: new Set(["rule.propose"]), environment: "STAGING", stagingTestOnly: true })).toBe("UNDER_REVIEW");
    expect(evaluatePassportProfileTransition({ current: "UNDER_REVIEW", action: "APPROVE", actorPermissions: new Set(["rule.review"]), environment: "STAGING", stagingTestOnly: true })).toBe("APPROVED");
    expect(evaluatePassportProfileTransition({ current: "APPROVED", action: "ACTIVATE", actorPermissions: new Set(["rule.activate"]), environment: "STAGING", stagingTestOnly: true })).toBe("ACTIVE");
    expect(() => evaluatePassportProfileTransition({ current: "UNDER_REVIEW", action: "APPROVE", actorPermissions: new Set(["rule.propose"]), environment: "STAGING", stagingTestOnly: true })).toThrow("PASSPORT_PROFILE_GOVERNANCE_ACCESS_DENIED");
  });

  it("fails invalid transitions and prevents synthetic activation in Production", () => {
    expect(() => evaluatePassportProfileTransition({ current: "DRAFT", action: "ACTIVATE", actorPermissions: new Set(["rule.activate"]), environment: "STAGING", stagingTestOnly: true })).toThrow("PASSPORT_PROFILE_TRANSITION_INVALID");
    expect(() => evaluatePassportProfileTransition({ current: "APPROVED", action: "ACTIVATE", actorPermissions: new Set(["rule.activate"]), environment: "PRODUCTION", stagingTestOnly: true })).toThrow("PASSPORT_PROFILE_STAGING_TEST_PRODUCTION_FORBIDDEN");
  });

  it("supports explicit immutable supersession and retirement", () => {
    expect(evaluatePassportProfileTransition({ current: "ACTIVE", action: "SUPERSEDE", actorPermissions: new Set(["rule.activate"]), environment: "STAGING", stagingTestOnly: false })).toBe("SUPERSEDED");
    expect(evaluatePassportProfileTransition({ current: "ACTIVE", action: "RETIRE", actorPermissions: new Set(["rule.activate"]), environment: "STAGING", stagingTestOnly: false })).toBe("RETIRED");
  });
});
