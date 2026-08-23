import { describe, expect, it } from "vitest";
import type { EligibilityRule } from "../eligibility/eligibility-engine";
import { InMemoryRuleRegistryRepository } from "./rule-repository";

function rule(version: number): EligibilityRule {
  return {
    id: "SYNTHETIC-RULE", version, routeCode: "ROUTE", layer: "BASE_ROUTE", classification: "OFFICIAL",
    sourceAuthority: "Synthetic Authority", reason: `Version ${version}`,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"), effectiveTo: null,
    conditions: [], eligibilityEffect: "ELIGIBLE", requiredDocuments: [`DOC_V${version}`], conditionalDocuments: [],
  };
}

describe("Rule Registry repository", () => {
  it("keeps rule versions immutable and returns only current ACTIVE versions", () => {
    const repository = new InMemoryRuleRegistryRepository();
    const version1 = rule(1);
    repository.appendVersion(version1);
    repository.appendStatus({ id: "e1", ruleId: version1.id, version: 1, status: "ACTIVE", reason: "Synthetic activation", actorReference: "staff:1", occurredAt: "2026-01-01T00:00:00.000Z" });
    repository.appendVersion(rule(2));
    repository.appendStatus({ id: "e2", ruleId: version1.id, version: 1, status: "RETIRED", reason: "Replaced", actorReference: "staff:1", occurredAt: "2026-02-01T00:00:00.000Z" });
    repository.appendStatus({ id: "e3", ruleId: version1.id, version: 2, status: "ACTIVE", reason: "Reviewed replacement", actorReference: "staff:1", occurredAt: "2026-02-01T00:00:01.000Z" });
    version1.requiredDocuments = ["MUTATED_OUTSIDE_REPOSITORY"];
    expect(repository.activeForRoute("ROUTE").map((item) => item.version)).toEqual([2]);
    expect(repository.versions("SYNTHETIC-RULE")[0].requiredDocuments).toEqual(["DOC_V1"]);
  });

  it("rejects duplicate versions and status events", () => {
    const repository = new InMemoryRuleRegistryRepository();
    repository.appendVersion(rule(1));
    expect(() => repository.appendVersion(rule(1))).toThrow(/already exists/i);
    const event = { id: "e1", ruleId: "SYNTHETIC-RULE", version: 1, status: "DRAFT" as const, reason: "Imported", actorReference: "staff:1", occurredAt: "2026-01-01T00:00:00.000Z" };
    repository.appendStatus(event);
    expect(() => repository.appendStatus(event)).toThrow(/already exists/i);
  });
});
