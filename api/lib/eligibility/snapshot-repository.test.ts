import { describe, expect, it } from "vitest";
import { createEvaluationEvidence } from "./evaluation-evidence";
import { evaluateEligibility, type EligibilityRule } from "./eligibility-engine";
import { InMemoryEligibilitySnapshotRepository } from "./snapshot-repository";

const evaluatedAt = new Date("2026-06-01T00:00:00.000Z");
function rule(version: number, documents: readonly string[]): EligibilityRule {
  return {
    id: "OFFICIAL-ROUTE", version, routeCode: "ROUTE", layer: "BASE_ROUTE", classification: "OFFICIAL",
    sourceAuthority: "Synthetic Authority", reason: `Official rule v${version}`,
    effectiveFrom: new Date("2026-01-01T00:00:00.000Z"), effectiveTo: null, conditions: [],
    eligibilityEffect: "ELIGIBLE", requiredDocuments: documents, conditionalDocuments: [],
  };
}

function snapshot(input: {
  evaluationId: string; applicationId?: number; applicantId?: number; version: number;
  documents: readonly string[]; supersedes?: string; reason?: string; evaluatedAt?: Date;
}) {
  const time = input.evaluatedAt ?? evaluatedAt;
  const result = evaluateEligibility({
    profile: { routeCode: "ROUTE", attributes: {} }, rules: [rule(input.version, input.documents)], evaluatedAt: time,
  });
  return createEvaluationEvidence({
    evaluationId: input.evaluationId,
    applicationId: input.applicationId ?? 1,
    applicantId: input.applicantId ?? 11,
    selectedRoute: "ROUTE",
    evaluatedAt: time,
    result,
    supersedesEvaluationId: input.supersedes,
    reevaluationReason: input.reason,
  });
}

function select(repository: InMemoryEligibilitySnapshotRepository, evaluationId: string, applicantId = 11, selectedAt = "2026-06-01T00:00:00.000Z") {
  repository.select({
    id: `selection-${evaluationId}`, applicationId: 1, applicantId, evaluationId,
    reason: "Approved current evaluation", selectedBy: "staff:synthetic", selectedAt,
  });
}

describe("immutable eligibility snapshots", () => {
  it("preserves the historical result after a rule changes", () => {
    const repository = new InMemoryEligibilitySnapshotRepository();
    const original = snapshot({ evaluationId: "eval-v1", version: 1, documents: ["PASSPORT"] });
    repository.append(original);
    const changedRuleResult = snapshot({
      evaluationId: "eval-v2", version: 2, documents: ["PASSPORT", "PHOTO"],
      supersedes: "eval-v1", reason: "Official rule version changed",
      evaluatedAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    repository.append(changedRuleResult);
    expect(repository.get("eval-v1")?.requiredDocuments).toEqual(["PASSPORT"]);
    expect(repository.get("eval-v2")?.requiredDocuments).toEqual(["PASSPORT", "PHOTO"]);
  });

  it("manual re-evaluation creates and selects a new snapshot", () => {
    const repository = new InMemoryEligibilitySnapshotRepository();
    repository.append(snapshot({ evaluationId: "eval-v1", version: 1, documents: ["PASSPORT"] }));
    select(repository, "eval-v1");
    repository.append(snapshot({
      evaluationId: "eval-v2", version: 2, documents: ["PASSPORT", "PHOTO"],
      supersedes: "eval-v1", reason: "Manual re-evaluation after document review",
      evaluatedAt: new Date("2026-07-01T00:00:00.000Z"),
    }));
    select(repository, "eval-v2", 11, "2026-07-01T00:00:00.000Z");
    expect(repository.current(1, 11)?.evaluationId).toBe("eval-v2");
    expect(repository.history(1, 11).map((item) => item.evaluationId)).toEqual(["eval-v1", "eval-v2"]);
    expect(repository.changeSummary(1, 11)).toMatchObject({
      previousEvaluationId: "eval-v1",
      currentEvaluationId: "eval-v2",
      changedFields: expect.arrayContaining(["matchedRuleVersions", "requiredDocuments"]),
      reevaluationReason: "Manual re-evaluation after document review",
    });
  });

  it("generates customer requirements only from the selected snapshot", () => {
    const repository = new InMemoryEligibilitySnapshotRepository();
    repository.append(snapshot({ evaluationId: "eval-v1", version: 1, documents: ["OLD_DOCUMENT"] }));
    repository.append(snapshot({ evaluationId: "eval-v2", version: 2, documents: ["CURRENT_DOCUMENT"], supersedes: "eval-v1" }));
    select(repository, "eval-v2");
    expect(repository.currentCustomerRequirements(1, 11)).toMatchObject({
      evaluationId: "eval-v2",
      requiredDocuments: ["CURRENT_DOCUMENT"],
    });
  });

  it("identifies affected current applications without selecting a new evaluation", () => {
    const repository = new InMemoryEligibilitySnapshotRepository();
    repository.append(snapshot({ evaluationId: "eval-v1", version: 1, documents: ["PASSPORT"] }));
    select(repository, "eval-v1");
    expect(repository.affectedCurrentApplications("OFFICIAL-ROUTE")).toEqual([1]);
    expect(repository.current(1, 11)?.evaluationId).toBe("eval-v1");
  });

  it("rejects cross-applicant re-evaluation and selection", () => {
    const repository = new InMemoryEligibilitySnapshotRepository();
    repository.append(snapshot({ evaluationId: "eval-a", applicantId: 11, version: 1, documents: ["A"] }));
    expect(() => repository.append(snapshot({
      evaluationId: "eval-b", applicantId: 12, version: 2, documents: ["B"], supersedes: "eval-a",
    }))).toThrow(/cross applicant ownership/i);
    expect(() => select(repository, "eval-a", 12)).toThrow(/ownership mismatch/i);
  });
});
