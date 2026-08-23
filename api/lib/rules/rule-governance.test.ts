import { describe, expect, it } from "vitest";
import { evaluateRuleTransition } from "./rule-governance";

describe("rule governance", () => {
  it("supports the reviewed draft lifecycle", () => {
    expect(evaluateRuleTransition({
      currentStatus: "DRAFT",
      action: "SUBMIT_FOR_REVIEW",
      permissions: new Set(["rule.propose"]),
      environment: "STAGING",
      ownerActivationApproved: false,
    }).resultingStatus).toBe("UNDER_REVIEW");
  });

  it("rejects activation directly from DRAFT", () => {
    expect(evaluateRuleTransition({
      currentStatus: "DRAFT",
      action: "ACTIVATE",
      permissions: new Set(["rule.activate"]),
      environment: "STAGING",
      ownerActivationApproved: false,
    }).reason).toBe("INVALID_TRANSITION");
  });

  it("requires an explicit rule activation permission", () => {
    expect(evaluateRuleTransition({
      currentStatus: "APPROVED",
      action: "ACTIVATE",
      permissions: new Set(),
      environment: "STAGING",
      ownerActivationApproved: true,
    }).reason).toBe("PERMISSION_DENIED");
  });

  it("adds a separate owner gate for Production activation", () => {
    expect(evaluateRuleTransition({
      currentStatus: "APPROVED",
      action: "ACTIVATE",
      permissions: new Set(["rule.activate"]),
      environment: "PRODUCTION",
      ownerActivationApproved: false,
    }).reason).toBe("OWNER_GATE_REQUIRED");
  });

  it("permits approved staging activation without pretending it is Production", () => {
    expect(evaluateRuleTransition({
      currentStatus: "APPROVED",
      action: "ACTIVATE",
      permissions: new Set(["rule.activate"]),
      environment: "STAGING",
      ownerActivationApproved: false,
    })).toEqual({ allowed: true, resultingStatus: "ACTIVE", reason: "ALLOWED" });
  });
});
