import type { AuthorizationResource } from "../authorization/policy";

export type ApplicationStatus =
  | "submitted" | "payment_received" | "documents_pending" | "documents_received"
  | "under_review" | "visa_processing" | "visa_received" | "completed" | "rejected" | "cancelled";

export type HumanReviewOutcome = "APPROVED_FOR_NEXT_STEP" | "NEEDS_CORRECTION" | "MANUAL_REVIEW_REQUIRED" | "REJECTED_OPERATIONALLY";
export type DocumentReviewOutcome = "ACCEPTED" | "REJECTED" | "NEEDS_REPLACEMENT" | "UNREADABLE" | "MISMATCH" | "MANUAL_REVIEW";

export type ControlledCaseState = {
  applicationId: number;
  version: number;
  status: ApplicationStatus;
  assignedActorId?: string;
  teamId?: number;
  departmentId?: number;
  applicantIds: readonly number[];
  documents: readonly { documentId: number; applicantId: number; version: number }[];
  finance: Readonly<Record<string, string | null>>;
};

export type ControlledAuditEvent = {
  id: string;
  applicationId: number;
  action: "HUMAN_REVIEW" | "DOCUMENT_REVIEW" | "ASSIGN" | "CLAIM" | "REASSIGN" | "STATUS_TRANSITION" | "REEVALUATION_REQUEST";
  actorId: string;
  reason: string;
  entityVersionBefore: number;
  entityVersionAfter: number;
  details: Readonly<Record<string, unknown>>;
  occurredAt: string;
};

export type WriteResult = { status: "APPLIED" | "IDEMPOTENT_REPLAY"; applicationId: number; version: number; auditEventId: string };

type IdempotencyRecord = { fingerprint: string; result: WriteResult };

export class InMemoryControlledWriteRepository {
  readonly #cases = new Map<number, ControlledCaseState>();
  readonly #audit: ControlledAuditEvent[] = [];
  readonly #idempotency = new Map<string, IdempotencyRecord>();
  readonly #workload = new Map<string, number>();

  seed(state: ControlledCaseState): void {
    if (this.#cases.has(state.applicationId)) throw new Error("Controlled case already exists");
    this.#cases.set(state.applicationId, structuredClone(state));
    if (state.assignedActorId) this.#workload.set(state.assignedActorId, (this.#workload.get(state.assignedActorId) ?? 0) + 1);
  }

  get(applicationId: number): ControlledCaseState | null {
    const state = this.#cases.get(applicationId);
    return state ? structuredClone(state) : null;
  }

  resource(applicationId: number): AuthorizationResource {
    const state = this.#cases.get(applicationId);
    if (!state) throw new Error("CONTROLLED_CASE_NOT_FOUND");
    return { assignedActorId: state.assignedActorId, teamId: state.teamId, departmentId: state.departmentId };
  }

  workload(actorId: string): number { return this.#workload.get(actorId) ?? 0; }

  seedWorkload(actorId: string, count: number): void {
    if (!actorId.trim() || !Number.isSafeInteger(count) || count < 0) throw new Error("INVALID_WORKLOAD_EVIDENCE");
    this.#workload.set(actorId, count);
  }

  audit(applicationId: number): readonly ControlledAuditEvent[] {
    return this.#audit.filter((event) => event.applicationId === applicationId).map((event) => structuredClone(event));
  }

  apply(input: {
    applicationId: number;
    expectedVersion: number;
    idempotencyKey: string;
    fingerprint: string;
    auditEventId: string;
    action: ControlledAuditEvent["action"];
    actorId: string;
    reason: string;
    occurredAt: string;
    mutate: (draft: ControlledCaseState) => { details: Readonly<Record<string, unknown>>; workloadChange?: { from?: string; to?: string } };
  }): WriteResult {
    const scopedIdempotencyKey = `${input.applicationId}:${input.idempotencyKey}`;
    const existing = this.#idempotency.get(scopedIdempotencyKey);
    if (existing) {
      if (existing.fingerprint !== input.fingerprint) throw new Error("IDEMPOTENCY_KEY_CONFLICT");
      return { ...existing.result, status: "IDEMPOTENT_REPLAY" };
    }
    const current = this.#cases.get(input.applicationId);
    if (!current) throw new Error("CONTROLLED_CASE_NOT_FOUND");
    if (current.version !== input.expectedVersion) throw new Error("STALE_ENTITY_VERSION");
    if (!input.idempotencyKey.trim() || !input.auditEventId.trim()) throw new Error("WRITE_EVIDENCE_REQUIRED");
    if (this.#audit.some((item) => item.id === input.auditEventId)) throw new Error("AUDIT_EVENT_ID_CONFLICT");
    const draft = structuredClone(current);
    const financeBefore = JSON.stringify(draft.finance);
    const mutation = input.mutate(draft);
    if (JSON.stringify(draft.finance) !== financeBefore) throw new Error("FINANCIAL_FIELDS_ARE_IMMUTABLE_IN_OPERATIONS_ACTIONS");
    draft.version += 1;
    const event: ControlledAuditEvent = {
      id: input.auditEventId, applicationId: input.applicationId, action: input.action, actorId: input.actorId,
      reason: input.reason, entityVersionBefore: current.version, entityVersionAfter: draft.version,
      details: structuredClone(mutation.details), occurredAt: input.occurredAt,
    };
    this.#cases.set(input.applicationId, draft);
    if (mutation.workloadChange?.from) this.#workload.set(mutation.workloadChange.from, Math.max(0, this.workload(mutation.workloadChange.from) - 1));
    if (mutation.workloadChange?.to) this.#workload.set(mutation.workloadChange.to, this.workload(mutation.workloadChange.to) + 1);
    this.#audit.push(event);
    const result: WriteResult = { status: "APPLIED", applicationId: input.applicationId, version: draft.version, auditEventId: event.id };
    this.#idempotency.set(scopedIdempotencyKey, { fingerprint: input.fingerprint, result });
    return result;
  }
}
