import { describe, expect, it } from "vitest";
import { InMemoryFamilyPersistenceRepository } from "./family-persistence";

describe("append-only family persistence repository", () => {
  it("derives the current relationship graph without deleting history", () => {
    const repository = new InMemoryFamilyPersistenceRepository();
    repository.appendRelationship({ id: "r1", applicationId: 1, fromApplicantId: 10, toApplicantId: 11, relationship: "CHILD", eventType: "ESTABLISHED", reason: "Declared", occurredAt: "2026-01-01" });
    repository.appendRelationship({ id: "r2", applicationId: 1, fromApplicantId: 10, toApplicantId: 11, relationship: "CHILD", eventType: "REVOKED", reason: "Corrected", occurredAt: "2026-01-02" });
    expect(repository.relationshipHistory(1)).toHaveLength(2);
    expect(repository.currentRelationships(1)).toEqual([]);
  });

  it("rejects ambiguous duplicate or invalid relationship events", () => {
    const repository = new InMemoryFamilyPersistenceRepository();
    expect(() => repository.appendRelationship({ id: "self", applicationId: 1, fromApplicantId: 10, toApplicantId: 10, relationship: "OTHER", eventType: "ESTABLISHED", reason: "Invalid", occurredAt: "2026-01-01" })).toThrow(/different/i);
    expect(() => repository.appendRelationship({ id: "missing", applicationId: 1, fromApplicantId: 10, toApplicantId: 11, relationship: "CHILD", eventType: "REVOKED", reason: "Invalid", occurredAt: "2026-01-01" })).toThrow(/active/i);
  });

  it("keeps requirement instances and state history applicant/evaluation scoped", () => {
    const repository = new InMemoryFamilyPersistenceRepository();
    repository.appendRequirementInstance({ id: "req-a", applicationId: 1, applicantId: 10, evaluationId: "eval-a-v1", catalogVersion: "v1", code: "PASSPORT", kind: "DOCUMENT", critical: true, conditional: false, createdAt: "2026-01-01" });
    repository.appendRequirementInstance({ id: "req-b", applicationId: 1, applicantId: 11, evaluationId: "eval-b-v7", catalogVersion: "v3", code: "RESIDENCE", kind: "DOCUMENT", critical: true, conditional: false, createdAt: "2026-01-01" });
    repository.appendRequirementEvent({ id: "e1", instanceId: "req-a", state: "MISSING", reason: "Required", occurredAt: "2026-01-01" });
    repository.appendRequirementEvent({ id: "e2", instanceId: "req-a", state: "VALIDATED", reason: "Uploaded and checked", occurredAt: "2026-01-02" });
    expect(repository.requirements(1, 10, "eval-a-v1")).toMatchObject([{ currentState: "VALIDATED" }]);
    expect(repository.requirements(1, 11, "eval-b-v7")).toMatchObject([{ currentState: null }]);
    expect(repository.requirementHistory("req-a")).toHaveLength(2);
  });

  it("creates new instances for re-evaluation without rewriting the old evaluation", () => {
    const repository = new InMemoryFamilyPersistenceRepository();
    repository.appendRequirementInstance({ id: "old", applicationId: 1, applicantId: 10, evaluationId: "eval-v1", catalogVersion: "v1", code: "PHOTO", kind: "DOCUMENT", critical: true, conditional: false, createdAt: "2026-01-01" });
    repository.appendRequirementInstance({ id: "new", applicationId: 1, applicantId: 10, evaluationId: "eval-v2", catalogVersion: "v2", code: "PHOTO", kind: "DOCUMENT", critical: true, conditional: false, createdAt: "2026-02-01" });
    expect(repository.requirements(1, 10, "eval-v1")[0].instance.id).toBe("old");
    expect(repository.requirements(1, 10, "eval-v2")[0].instance.id).toBe("new");
  });
});
