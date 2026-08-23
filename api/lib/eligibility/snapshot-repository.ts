import type { EvaluationEvidenceSnapshot } from "./evaluation-evidence";

export type EvaluationSelection = {
  id: string;
  applicationId: number;
  applicantId: number;
  evaluationId: string;
  reason: string;
  selectedBy: string;
  selectedAt: string;
};

export type EvaluationChange = {
  previousEvaluationId: string | null;
  currentEvaluationId: string;
  changedFields: readonly string[];
  reevaluationReason: string | null;
};

function cloneSnapshot(snapshot: EvaluationEvidenceSnapshot): EvaluationEvidenceSnapshot {
  return structuredClone(snapshot);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class InMemoryEligibilitySnapshotRepository {
  readonly #snapshots = new Map<string, EvaluationEvidenceSnapshot>();
  readonly #selections: EvaluationSelection[] = [];

  append(snapshot: EvaluationEvidenceSnapshot): void {
    if (this.#snapshots.has(snapshot.evaluationId)) throw new Error("Evaluation snapshot already exists");
    if (snapshot.supersedesEvaluationId) {
      const previous = this.#snapshots.get(snapshot.supersedesEvaluationId);
      if (!previous) throw new Error("Superseded evaluation does not exist");
      if (previous.applicationId !== snapshot.applicationId || previous.applicantId !== snapshot.applicantId) {
        throw new Error("Re-evaluation cannot cross applicant ownership");
      }
    }
    this.#snapshots.set(snapshot.evaluationId, cloneSnapshot(snapshot));
  }

  select(selection: EvaluationSelection): void {
    const snapshot = this.#snapshots.get(selection.evaluationId);
    if (!snapshot) throw new Error("Selected evaluation does not exist");
    if (snapshot.applicationId !== selection.applicationId || snapshot.applicantId !== selection.applicantId) {
      throw new Error("Evaluation selection ownership mismatch");
    }
    if (this.#selections.some((event) => event.id === selection.id)) throw new Error("Selection event already exists");
    this.#selections.push(structuredClone(selection));
  }

  get(evaluationId: string): EvaluationEvidenceSnapshot | null {
    const snapshot = this.#snapshots.get(evaluationId);
    return snapshot ? cloneSnapshot(snapshot) : null;
  }

  history(applicationId: number, applicantId: number): EvaluationEvidenceSnapshot[] {
    return [...this.#snapshots.values()]
      .filter((snapshot) => snapshot.applicationId === applicationId && snapshot.applicantId === applicantId)
      .sort((left, right) => left.evaluatedAt.localeCompare(right.evaluatedAt)
        || left.evaluationId.localeCompare(right.evaluationId))
      .map(cloneSnapshot);
  }

  current(applicationId: number, applicantId: number): EvaluationEvidenceSnapshot | null {
    const selection = this.#selections
      .filter((event) => event.applicationId === applicationId && event.applicantId === applicantId)
      .sort((left, right) => right.selectedAt.localeCompare(left.selectedAt) || right.id.localeCompare(left.id))[0];
    return selection ? this.get(selection.evaluationId) : null;
  }

  changeSummary(applicationId: number, applicantId: number): EvaluationChange | null {
    const current = this.current(applicationId, applicantId);
    if (!current) return null;
    const previous = current.supersedesEvaluationId ? this.get(current.supersedesEvaluationId) : null;
    const fields: Array<keyof EvaluationEvidenceSnapshot> = [
      "eligibilityState", "selectedRoute", "matchedRuleVersions", "sourceAuthorities",
      "requiredDocuments", "conditionalDocuments", "warnings", "manualReviewReason",
    ];
    return {
      previousEvaluationId: previous?.evaluationId ?? null,
      currentEvaluationId: current.evaluationId,
      changedFields: previous ? fields.filter((field) => !sameJson(previous[field], current[field])) : [],
      reevaluationReason: current.reevaluationReason,
    };
  }

  currentCustomerRequirements(applicationId: number, applicantId: number) {
    const current = this.current(applicationId, applicantId);
    if (!current) return null;
    return {
      evaluationId: current.evaluationId,
      requiredDocuments: current.requiredDocuments,
      conditionalDocuments: current.conditionalDocuments,
      warnings: current.warnings,
    };
  }

  affectedCurrentApplications(ruleId: string): number[] {
    const currentByApplicant = new Map<string, EvaluationEvidenceSnapshot>();
    for (const selection of [...this.#selections]
      .sort((left, right) => left.selectedAt.localeCompare(right.selectedAt) || left.id.localeCompare(right.id))) {
      const snapshot = this.#snapshots.get(selection.evaluationId);
      if (snapshot) currentByApplicant.set(`${selection.applicationId}:${selection.applicantId}`, snapshot);
    }
    return [...new Set([...currentByApplicant.values()]
      .filter((snapshot) => snapshot.matchedRuleIds.includes(ruleId))
      .map((snapshot) => snapshot.applicationId))].sort((left, right) => left - right);
  }
}
