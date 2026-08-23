import { describe, expect, it } from "vitest";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { EligibilityRule } from "./eligibility-engine";
import { InMemoryRuleRegistryRepository } from "../rules/rule-repository";
import { InMemoryEligibilitySnapshotRepository } from "./snapshot-repository";
import { evaluateApplicantWithRegistry } from "./applicant-evaluation-service";

const enabledFlag: FeatureFlagRecord = {
  flagKey: "VISA_RULES_EVALUATION", environment: "STAGING", enabled: true,
  scopeType: "APPLICATION", scopeReference: "TSH-SYNTHETIC",
};

function activeRegistry() {
  const repository = new InMemoryRuleRegistryRepository();
  const rule: EligibilityRule = {
    id: "BASE", version: 1, routeCode: "ROUTE", layer: "BASE_ROUTE", classification: "OFFICIAL",
    sourceAuthority: "Synthetic Authority", reason: "Synthetic eligibility", effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    effectiveTo: null, conditions: [], eligibilityEffect: "ELIGIBLE", requiredDocuments: ["PASSPORT"], conditionalDocuments: [],
  };
  repository.appendVersion(rule);
  repository.appendStatus({ id: "active-1", ruleId: "BASE", version: 1, status: "ACTIVE", reason: "Synthetic", actorReference: "staff:1", occurredAt: "2026-01-01T00:00:00.000Z" });
  return repository;
}

function input(flags: readonly FeatureFlagRecord[], environment: "STAGING" | "PRODUCTION" = "STAGING") {
  return {
    featureContext: { environment, applicationReference: "TSH-SYNTHETIC" },
    featureFlags: flags,
    registry: activeRegistry(),
    snapshots: new InMemoryEligibilitySnapshotRepository(),
    evaluationId: "eval-1",
    selectionEventId: "select-1",
    applicationId: 1,
    applicantId: 11,
    profile: { routeCode: "ROUTE", attributes: {} },
    evaluatedAt: new Date("2026-06-01T00:00:00.000Z"),
    actorReference: "staff:1",
    selectAsCurrent: true,
  };
}

describe("applicant evaluation feature boundary", () => {
  it("does not evaluate or persist when the feature flag is closed", () => {
    const request = input([]);
    expect(evaluateApplicantWithRegistry(request)).toEqual({ status: "FEATURE_DISABLED" });
    expect(request.snapshots.history(1, 11)).toEqual([]);
  });

  it("evaluates a synthetic application only when explicitly enabled", () => {
    const request = input([enabledFlag]);
    const result = evaluateApplicantWithRegistry(request);
    expect(result.status).toBe("EVALUATED");
    expect(request.snapshots.current(1, 11)).toMatchObject({
      evaluationId: "eval-1", eligibilityState: "ELIGIBLE", requiredDocuments: ["PASSPORT"],
    });
  });

  it("does not allow a staging flag to enable Production evaluation", () => {
    const request = input([enabledFlag], "PRODUCTION");
    expect(evaluateApplicantWithRegistry(request)).toEqual({ status: "FEATURE_DISABLED" });
  });
});
