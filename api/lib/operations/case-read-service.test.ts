import { describe, expect, it } from "vitest";
import { ROLE_TEMPLATES, type Permission } from "../authorization/permissions";
import type { AuthorizationActor } from "../authorization/policy";
import { createEvaluationEvidence } from "../eligibility/evaluation-evidence";
import { evaluateEligibility, type EligibilityRule } from "../eligibility/eligibility-engine";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import { InMemoryFamilyPersistenceRepository } from "../family/family-persistence";
import { readOperationsCase } from "./case-read-service";
import type { OperationsCaseSource } from "./case-read-model";

const enabled: FeatureFlagRecord = {
  flagKey: "OPERATIONS_CASE_READ_MODEL", environment: "STAGING", enabled: true, scopeType: "GLOBAL", scopeReference: "",
};

function actor(input: { permissions?: readonly Permission[]; scopes?: AuthorizationActor["scopes"]; teamIds?: number[]; id?: string } = {}): AuthorizationActor {
  return {
    id: input.id ?? "staff:7",
    permissions: new Set(input.permissions ?? ROLE_TEMPLATES.OPERATIONS_EMPLOYEE),
    scopes: input.scopes ?? ["ASSIGNED"],
    teamIds: new Set(input.teamIds ?? [3]),
    departmentIds: new Set([2]),
  };
}

function source(legacy = false): OperationsCaseSource {
  return {
    summary: { applicationId: 1, reference: "TSH-SYNTHETIC", status: "REVIEW", createdAt: "2026-01-01", assignedActorId: "staff:7", teamId: 3, departmentId: 2, legacy },
    applicants: [
      { applicantId: 11, applicantIndex: 0, displayName: "Father", nationality: "EGYPT", residenceCountry: "UAE", routeCompatible: true },
      { applicantId: 12, applicantIndex: 1, displayName: "Mother", nationality: "INDIA", residenceCountry: "QATAR", routeCompatible: true },
    ],
    documents: [
      { documentId: 101, applicantId: 11, code: "PASSPORT_EG", readiness: "VALIDATED" },
      { documentId: 102, applicantId: 12, code: "PASSPORT_IN", readiness: "MISSING" },
    ],
    supplier: { id: 5, name: "Synthetic Supplier", slaHours: 24, reliabilityScore: 95, effectiveCost: "100", internalCost: "90" },
    operationalHistory: [{ id: "timeline-1", event: "CASE_CREATED", actorType: "SYSTEM", occurredAt: "2026-01-01" }],
  };
}

function appendEvaluation(input: {
  repository: InMemoryEligibilitySnapshotRepository;
  applicantId: number;
  ruleId: string;
  version: number;
  document: string;
  evaluationId?: string;
  supersedes?: string;
  reevaluationReason?: string;
  day?: number;
}) {
  const rule: EligibilityRule = {
    id: input.ruleId, version: input.version, routeCode: "FAMILY", layer: "BASE_ROUTE", classification: "OFFICIAL",
    sourceAuthority: `${input.ruleId} Authority`, reason: "Synthetic official rule", effectiveFrom: new Date("2026-01-01"), effectiveTo: null,
    conditions: [], eligibilityEffect: "ELIGIBLE", requiredDocuments: [input.document], conditionalDocuments: [],
  };
  const result = evaluateEligibility({ profile: { routeCode: "FAMILY", attributes: {} }, rules: [rule], evaluatedAt: new Date("2026-06-01") });
  const evaluationId = input.evaluationId ?? `eval-${input.applicantId}-${input.version}`;
  input.repository.append(createEvaluationEvidence({
    evaluationId, applicationId: 1, applicantId: input.applicantId, selectedRoute: "FAMILY",
    evaluatedAt: new Date(`2026-06-${String(input.day ?? input.version).padStart(2, "0")}T00:00:00Z`),
    result, supersedesEvaluationId: input.supersedes, reevaluationReason: input.reevaluationReason,
  }));
  input.repository.select({ id: `select-${evaluationId}`, applicationId: 1, applicantId: input.applicantId, evaluationId, reason: "Approved", selectedBy: "staff:7", selectedAt: `2026-06-${String(input.day ?? input.version).padStart(2, "0")}T01:00:00Z` });
  return evaluationId;
}

function fixture() {
  const snapshots = new InMemoryEligibilitySnapshotRepository();
  const family = new InMemoryFamilyPersistenceRepository();
  const father = appendEvaluation({ repository: snapshots, applicantId: 11, ruleId: "EGYPT-UAE", version: 2, document: "PASSPORT_EG" });
  const mother = appendEvaluation({ repository: snapshots, applicantId: 12, ruleId: "INDIA-QATAR", version: 7, document: "PASSPORT_IN" });
  family.appendRequirementInstance({ id: "father-passport", applicationId: 1, applicantId: 11, evaluationId: father, catalogVersion: "v2", code: "PASSPORT_EG", kind: "DOCUMENT", critical: true, conditional: false, createdAt: "2026-06-01" });
  family.appendRequirementEvent({ id: "father-valid", instanceId: "father-passport", state: "VALIDATED", reason: "Checked", occurredAt: "2026-06-02" });
  family.appendRequirementInstance({ id: "mother-passport", applicationId: 1, applicantId: 12, evaluationId: mother, catalogVersion: "v7", code: "PASSPORT_IN", kind: "DOCUMENT", critical: true, conditional: false, createdAt: "2026-06-01" });
  family.appendRequirementEvent({ id: "mother-missing", instanceId: "mother-passport", state: "MISSING", reason: "Required", occurredAt: "2026-06-02" });
  return { snapshots, family };
}

function read(input: { source?: OperationsCaseSource; actor?: AuthorizationActor; snapshots?: InMemoryEligibilitySnapshotRepository; family?: InMemoryFamilyPersistenceRepository; flags?: FeatureFlagRecord[] } = {}) {
  const defaults = fixture();
  return readOperationsCase({
    actor: input.actor ?? actor(), context: { environment: "STAGING" }, flags: input.flags ?? [enabled], source: input.source ?? source(),
    snapshots: input.snapshots ?? defaults.snapshots, family: input.family ?? defaults.family,
  });
}

describe("read-only Operations case gate", () => {
  it("renders mixed nationality and residence with independent rules/documents", () => {
    const model = read();
    expect(model.applicants[0]).toMatchObject({ displayName: "Father", nationality: "EGYPT", residenceCountry: "UAE", currentRuleVersions: [{ ruleId: "EGYPT-UAE", version: 2 }] });
    expect(model.applicants[1]).toMatchObject({ displayName: "Mother", nationality: "INDIA", residenceCountry: "QATAR", currentRuleVersions: [{ ruleId: "INDIA-QATAR", version: 7 }] });
    expect(model.applicants[0].documents.map((item) => item.code)).toEqual(["PASSPORT_EG"]);
    expect(model.applicants[1].documents.map((item) => item.code)).toEqual(["PASSPORT_IN"]);
  });

  it("shows current, history, changed fields, rule version and re-evaluation reason", () => {
    const { snapshots, family } = fixture();
    const current = appendEvaluation({ repository: snapshots, applicantId: 11, ruleId: "EGYPT-UAE", version: 3, document: "NEW_DOCUMENT", evaluationId: "father-v3", supersedes: "eval-11-2", reevaluationReason: "Official rule update", day: 9 });
    family.appendRequirementInstance({ id: "father-new", applicationId: 1, applicantId: 11, evaluationId: current, catalogVersion: "v3", code: "NEW_DOCUMENT", kind: "DOCUMENT", critical: true, conditional: false, createdAt: "2026-06-09" });
    const applicant = read({ snapshots, family }).applicants[0];
    expect(applicant.currentEvaluation?.evaluationId).toBe("father-v3");
    expect(applicant.previousEvaluations.map((item) => item.evaluationId)).toContain("eval-11-2");
    expect(applicant.evaluationChange).toMatchObject({ previousEvaluationId: "eval-11-2", reason: "Official rule update" });
    expect(applicant.evaluationChange?.changedFields).toContain("requiredDocuments");
  });

  it("exposes deterministic family blockers", () => {
    const model = read();
    expect(model.familyReadiness.family_readiness_state).toBe("NOT_READY");
    expect(model.familyReadiness.blocking_applicant_ids).toEqual([12]);
  });

  it("allows an assigned Operations employee only for the assigned case", () => {
    expect(read().summary.reference).toBe("TSH-SYNTHETIC");
    expect(() => read({ source: { ...source(), summary: { ...source().summary, assignedActorId: "staff:99" } } })).toThrow("OPERATIONS_CASE_ACCESS_DENIED");
  });

  it("allows a manager only within the permitted team scope", () => {
    const manager = actor({ permissions: ROLE_TEMPLATES.OPERATIONS_MANAGER, scopes: ["TEAM"], teamIds: [3] });
    expect(read({ actor: manager }).summary.teamId).toBe(3);
    expect(() => read({ actor: actor({ permissions: ROLE_TEMPLATES.OPERATIONS_MANAGER, scopes: ["TEAM"], teamIds: [9] }) })).toThrow("OPERATIONS_CASE_ACCESS_DENIED");
  });

  it("never returns supplier costs without finance permission", () => {
    const supplier = read().supplier;
    expect(supplier).toMatchObject({ id: 5, name: "Synthetic Supplier" });
    expect(supplier).not.toHaveProperty("effectiveCost");
    expect(supplier).not.toHaveProperty("internalCost");
  });

  it("never returns finance supplier fields through the Operations read model", () => {
    const permissions = [...ROLE_TEMPLATES.OPERATIONS_MANAGER, "supplier.read_financial" as const];
    const supplier = read({ actor: actor({ permissions, scopes: ["TEAM"] }) }).supplier;
    expect(supplier).not.toHaveProperty("effectiveCost");
    expect(supplier).not.toHaveProperty("internalCost");
  });

  it("renders legacy applications without inventing evaluations or relationships", () => {
    const model = read({ source: source(true), snapshots: new InMemoryEligibilitySnapshotRepository(), family: new InMemoryFamilyPersistenceRepository() });
    expect(model.mode).toBe("LEGACY_NOT_EVALUATED");
    expect(model.applicants.every((item) => item.currentEvaluation === null && item.previousEvaluations.length === 0)).toBe(true);
    expect(model.legacyWarnings).toContain("SPECIFIC_RELATIONSHIPS_REQUIRE_REVIEW");
  });

  it("rejects a document outside the case applicant set", () => {
    const invalid = source();
    invalid.documents = [...invalid.documents, { documentId: 999, applicantId: 999, code: "FOREIGN", readiness: "UPLOADED" }];
    expect(() => read({ source: invalid })).toThrow(/ownership/i);
  });

  it("is closed by default", () => {
    expect(() => read({ flags: [] })).toThrow("OPERATIONS_CASE_READ_MODEL_DISABLED");
  });
});
