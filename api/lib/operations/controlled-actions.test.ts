import { describe, expect, it } from "vitest";
import type { Permission } from "../authorization/permissions";
import type { AuthorizationActor } from "../authorization/policy";
import { createEvaluationEvidence, verifyEvaluationEvidence } from "../eligibility/evaluation-evidence";
import { evaluateEligibility, type EligibilityRule } from "../eligibility/eligibility-engine";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import { assignCase, recordHumanReview, requestReevaluation, reviewDocument, transitionCaseStatus } from "./controlled-actions";
import { InMemoryControlledWriteRepository } from "./controlled-write-repository";

const enabled: FeatureFlagRecord = { flagKey: "OPERATIONS_CONTROLLED_WRITES", environment: "STAGING", enabled: true, scopeType: "GLOBAL", scopeReference: "" };

function actor(permissions: readonly Permission[], teamIds = [3], scopes: AuthorizationActor["scopes"] = ["TEAM"]): AuthorizationActor {
  return { id: "staff:7", permissions: new Set(permissions), scopes, teamIds: new Set(teamIds), departmentIds: new Set([2]) };
}

function repository(assignedActorId: string | null = "staff:7", status: "documents_received" | "payment_received" | "completed" = "documents_received") {
  const value = new InMemoryControlledWriteRepository();
  value.seed({
    applicationId: 1, version: 4, status, assignedActorId: assignedActorId ?? undefined, teamId: 3, departmentId: 2,
    applicantIds: [11, 12], documents: [{ documentId: 101, applicantId: 11, version: 2 }, { documentId: 102, applicantId: 12, version: 1 }],
    finance: { supplierCost: "500.00", margin: "125.00", currency: "AED" },
  });
  return value;
}

function dependencies() {
  let id = 0;
  return { now: () => new Date("2026-08-23T12:00:00.000Z"), newId: () => `server-id-${++id}` };
}

function common(repo: InMemoryControlledWriteRepository, permissions: readonly Permission[], expectedVersion = 4) {
  return { actor: actor(permissions), context: { environment: "STAGING" as const }, flags: [enabled], repository: repo, applicationId: 1, expectedVersion, idempotencyKey: "idem-1" };
}

function rule(version: number, document = "PASSPORT"): EligibilityRule {
  return {
    id: "OFFICIAL-RULE", version, routeCode: "FAMILY", layer: "BASE_ROUTE", classification: "OFFICIAL",
    sourceAuthority: "Synthetic Authority", reason: "Synthetic official evidence", effectiveFrom: new Date("2026-01-01"), effectiveTo: null,
    conditions: [], eligibilityEffect: "ELIGIBLE", requiredDocuments: [document], conditionalDocuments: [],
  };
}

function snapshots() {
  const value = new InMemoryEligibilitySnapshotRepository();
  const evaluatedAt = new Date("2026-01-02");
  const result = evaluateEligibility({ profile: { routeCode: "FAMILY", attributes: {} }, rules: [rule(1)], evaluatedAt });
  const snapshot = createEvaluationEvidence({ evaluationId: "evaluation-v1", applicationId: 1, applicantId: 11, selectedRoute: "FAMILY", evaluatedAt, result });
  value.append(snapshot);
  value.select({ id: "selection-v1", applicationId: 1, applicantId: 11, evaluationId: snapshot.evaluationId, reason: "Initial", selectedBy: "system", selectedAt: evaluatedAt.toISOString() });
  return value;
}

describe("controlled Operations write layer", () => {
  it("denies unauthorized and wrong-team writes", () => {
    expect(() => recordHumanReview({ ...common(repository(), []), outcome: "MANUAL_REVIEW_REQUIRED", reason: "Requires review" }, dependencies())).toThrow("OPERATIONS_WRITE_ACCESS_DENIED");
    const repo = repository();
    expect(() => recordHumanReview({ ...common(repo, ["case.transition"]), actor: actor(["case.transition"], [9]), outcome: "MANUAL_REVIEW_REQUIRED", reason: "Requires review" }, dependencies())).toThrow("OPERATIONS_WRITE_ACCESS_DENIED");
    expect(repo.audit(1)).toHaveLength(0);
  });

  it("records human review with reviewer, server time, reason and audit event", () => {
    const repo = repository();
    const result = recordHumanReview({ ...common(repo, ["case.transition"]), outcome: "APPROVED_FOR_NEXT_STEP", reason: "Evidence is complete" }, dependencies());
    expect(result).toMatchObject({ status: "APPLIED", version: 5 });
    expect(repo.audit(1)[0]).toMatchObject({ action: "HUMAN_REVIEW", actorId: "staff:7", reason: "Evidence is complete", occurredAt: "2026-08-23T12:00:00.000Z", details: { outcome: "APPROVED_FOR_NEXT_STEP", reviewerId: "staff:7" } });
  });

  it("fails closed when action prerequisites are not satisfied", () => {
    expect(() => recordHumanReview({ ...common(repository("staff:7", "payment_received"), ["case.transition"]), outcome: "APPROVED_FOR_NEXT_STEP", reason: "Premature review" }, dependencies())).toThrow("HUMAN_REVIEW_PREREQUISITE_FAILED");
    expect(() => assignCase({ ...common(repository("staff:7", "completed"), ["case.assign"]), mode: "REASSIGN", assignee: { id: "staff:9", active: true, teamIds: new Set([3]), workloadLimit: 5 }, reason: "Late reassignment" }, dependencies())).toThrow("TERMINAL_CASE_IS_READ_ONLY");
  });

  it("rejects stale concurrent writes", () => {
    expect(() => recordHumanReview({ ...common(repository(), ["case.transition"], 3), outcome: "NEEDS_CORRECTION", reason: "Missing evidence" }, dependencies())).toThrow("STALE_ENTITY_VERSION");
  });

  it("returns an idempotent replay without a duplicate audit event", () => {
    const repo = repository();
    const input = { ...common(repo, ["case.transition"]), outcome: "NEEDS_CORRECTION" as const, reason: "Correct the evidence" };
    expect(recordHumanReview(input, dependencies()).status).toBe("APPLIED");
    expect(recordHumanReview(input, dependencies()).status).toBe("IDEMPOTENT_REPLAY");
    expect(repo.audit(1)).toHaveLength(1);
  });

  it("keeps document review applicant-scoped", () => {
    const repo = repository();
    expect(() => reviewDocument({ ...common(repo, ["document.review"]), applicantId: 12, documentId: 101, expectedDocumentVersion: 2, outcome: "REJECTED", reason: "Identity mismatch" }, dependencies())).toThrow("DOCUMENT_OWNERSHIP_MISMATCH");
    const applied = reviewDocument({ ...common(repo, ["document.review"]), applicantId: 11, documentId: 101, expectedDocumentVersion: 2, outcome: "NEEDS_REPLACEMENT", reason: "Image is cropped" }, dependencies());
    expect(applied.status).toBe("APPLIED");
    expect(repo.audit(1)[0].details).toMatchObject({ applicantId: 11, documentId: 101, outcome: "NEEDS_REPLACEMENT" });
  });

  it("rejects assignment collisions and workload overflow", () => {
    const collision = repository("staff:8");
    expect(() => assignCase({ ...common(collision, ["case.read_assigned"]), actor: actor(["case.read_assigned"]), mode: "CLAIM", assignee: { id: "staff:7", active: true, teamIds: new Set([3]), workloadLimit: 5 }, reason: "Claim available case" }, dependencies())).toThrow("ASSIGNMENT_COLLISION");
    const unassigned = repository(null);
    const assignee = { id: "staff:9", active: true, teamIds: new Set([3]), workloadLimit: 0 };
    expect(() => assignCase({ ...common(unassigned, ["case.assign"]), mode: "ASSIGN", assignee, reason: "Balance workload" }, dependencies())).toThrow("ASSIGNEE_WORKLOAD_LIMIT_REACHED");
  });

  it("supports a valid assignment with history and version protection", () => {
    const repo = repository(null);
    const input = { ...common(repo, ["case.assign"]), mode: "ASSIGN" as const, assignee: { id: "staff:9", active: true, teamIds: new Set([3]), workloadLimit: 5 }, reason: "Team allocation" };
    const result = assignCase(input, dependencies());
    expect(result.version).toBe(5);
    expect(assignCase(input, dependencies()).status).toBe("IDEMPOTENT_REPLAY");
    expect(repo.get(1)?.assignedActorId).toBe("staff:9");
    expect(repo.workload("staff:9")).toBe(1);
    expect(repo.audit(1)).toHaveLength(1);
    expect(repo.audit(1)[0]).toMatchObject({ action: "ASSIGN", details: { previousAssigneeId: null, assigneeId: "staff:9" } });
  });

  it("allows only controlled status transitions", () => {
    const valid = repository();
    expect(transitionCaseStatus({ ...common(valid, ["case.transition"]), to: "under_review", reason: "Documents complete" }, dependencies()).status).toBe("APPLIED");
    const invalid = repository();
    expect(() => transitionCaseStatus({ ...common(invalid, ["case.transition"]), to: "completed", reason: "Skip processing" }, dependencies())).toThrow("INVALID_STATUS_TRANSITION");
    expect(invalid.get(1)?.status).toBe("documents_received");
  });

  it("creates a new evaluation and preserves immutable history", () => {
    const repo = repository();
    const evidence = snapshots();
    const before = evidence.get("evaluation-v1");
    const input = {
      ...common(repo, ["rule.review"]), snapshots: evidence, applicantId: 11, expectedCurrentEvaluationId: "evaluation-v1",
      selectedRoute: "FAMILY", profile: { routeCode: "FAMILY", attributes: {} }, rules: [rule(2, "NEW_PASSPORT")], reason: "Official rule version changed",
    };
    const result = requestReevaluation(input, dependencies());
    expect(result.status).toBe("APPLIED");
    const current = evidence.current(1, 11);
    expect(current?.evaluationId).not.toBe("evaluation-v1");
    expect(current?.supersedesEvaluationId).toBe("evaluation-v1");
    expect(evidence.get("evaluation-v1")).toEqual(before);
    expect(before && verifyEvaluationEvidence(before)).toBe(true);
    expect(evidence.history(1, 11)).toHaveLength(2);
    expect(requestReevaluation(input, dependencies()).status).toBe("IDEMPOTENT_REPLAY");
    expect(evidence.history(1, 11)).toHaveLength(2);
    expect(repo.audit(1)).toHaveLength(1);
  });

  it("rejects stale re-evaluation selection without creating history", () => {
    const evidence = snapshots();
    expect(() => requestReevaluation({
      ...common(repository(), ["rule.review"]), snapshots: evidence, applicantId: 11, expectedCurrentEvaluationId: "wrong",
      selectedRoute: "FAMILY", profile: { routeCode: "FAMILY", attributes: {} }, rules: [rule(2)], reason: "Official update",
    }, dependencies())).toThrow("STALE_EVALUATION_SELECTION");
    expect(evidence.history(1, 11)).toHaveLength(1);
  });

  it("never mutates financial fields", () => {
    const repo = repository();
    const before = repo.get(1)?.finance;
    recordHumanReview({ ...common(repo, ["case.transition"]), outcome: "REJECTED_OPERATIONALLY", reason: "Operational criteria not met" }, dependencies());
    expect(repo.get(1)?.finance).toEqual(before);
    expect(repo.audit(1)[0].details).not.toHaveProperty("finance");
  });

  it("keeps all writes closed by default", () => {
    const repo = repository();
    expect(() => recordHumanReview({ ...common(repo, ["case.transition"]), flags: [], outcome: "MANUAL_REVIEW_REQUIRED", reason: "Requires review" }, dependencies())).toThrow("OPERATIONS_CONTROLLED_WRITES_DISABLED");
  });
});
