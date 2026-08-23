import { authorize, type AuthorizationActor } from "../authorization/policy";
import type { Permission } from "../authorization/permissions";
import { createEvaluationEvidence } from "../eligibility/evaluation-evidence";
import { evaluateEligibility, type EligibilityProfile, type EligibilityRule } from "../eligibility/eligibility-engine";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";
import { isOperationsFlagEnabled, type FeatureFlagContext, type FeatureFlagRecord } from "../feature-flags/feature-flags";
import { assertControlledTransition } from "./controlled-state-machine";
import {
  InMemoryControlledWriteRepository,
  type ApplicationStatus,
  type DocumentReviewOutcome,
  type HumanReviewOutcome,
  type WriteResult,
} from "./controlled-write-repository";

type Dependencies = { now: () => Date; newId: () => string };
type Common = {
  actor: AuthorizationActor;
  context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  repository: InMemoryControlledWriteRepository;
  applicationId: number;
  expectedVersion: number;
  idempotencyKey: string;
};

const HUMAN_OUTCOMES: readonly HumanReviewOutcome[] = ["APPROVED_FOR_NEXT_STEP", "NEEDS_CORRECTION", "MANUAL_REVIEW_REQUIRED", "REJECTED_OPERATIONALLY"];
const DOCUMENT_OUTCOMES: readonly DocumentReviewOutcome[] = ["ACCEPTED", "REJECTED", "NEEDS_REPLACEMENT", "UNREADABLE", "MISMATCH", "MANUAL_REVIEW"];

function gate(input: Common, permission: Permission): void {
  if (!input.actor.id.trim()) throw new Error("AUTHENTICATED_ACTOR_REQUIRED");
  if (!isOperationsFlagEnabled("OPERATIONS_CONTROLLED_WRITES", input.context, input.flags)) throw new Error("OPERATIONS_CONTROLLED_WRITES_DISABLED");
  if (!authorize(input.actor, permission, input.repository.resource(input.applicationId)).allowed) throw new Error("OPERATIONS_WRITE_ACCESS_DENIED");
}

function requireReason(reason: string): string {
  const value = reason.trim();
  if (value.length < 3) throw new Error("ACTION_REASON_REQUIRED");
  return value;
}

function fingerprint(value: Readonly<Record<string, unknown>>): string { return JSON.stringify(value); }

function assertNonTerminal(status: ApplicationStatus): void {
  if (["completed", "rejected", "cancelled"].includes(status)) throw new Error("TERMINAL_CASE_IS_READ_ONLY");
}

export function recordHumanReview(input: Common & { outcome: HumanReviewOutcome; reason: string }, deps: Dependencies): WriteResult {
  gate(input, "case.transition");
  if (!HUMAN_OUTCOMES.includes(input.outcome)) throw new Error("INVALID_HUMAN_REVIEW_OUTCOME");
  const reason = requireReason(input.reason);
  return input.repository.apply({
    ...input, auditEventId: deps.newId(), action: "HUMAN_REVIEW", actorId: input.actor.id, reason,
    occurredAt: deps.now().toISOString(), fingerprint: fingerprint({ action: "HUMAN_REVIEW", outcome: input.outcome, reason }),
    mutate: (draft) => {
      if (!["documents_received", "under_review"].includes(draft.status)) throw new Error("HUMAN_REVIEW_PREREQUISITE_FAILED");
      return { details: { outcome: input.outcome, reviewerId: input.actor.id } };
    },
  });
}

export function reviewDocument(input: Common & {
  applicantId: number;
  documentId: number;
  expectedDocumentVersion: number;
  outcome: DocumentReviewOutcome;
  reason: string;
}, deps: Dependencies): WriteResult {
  gate(input, "document.review");
  if (!DOCUMENT_OUTCOMES.includes(input.outcome)) throw new Error("INVALID_DOCUMENT_REVIEW_OUTCOME");
  const reason = requireReason(input.reason);
  return input.repository.apply({
    ...input, auditEventId: deps.newId(), action: "DOCUMENT_REVIEW", actorId: input.actor.id, reason,
    occurredAt: deps.now().toISOString(), fingerprint: fingerprint({ action: "DOCUMENT_REVIEW", applicantId: input.applicantId, documentId: input.documentId, outcome: input.outcome, reason }),
    mutate: (draft) => {
      if (!["documents_pending", "documents_received", "under_review"].includes(draft.status)) throw new Error("DOCUMENT_REVIEW_PREREQUISITE_FAILED");
      if (!draft.applicantIds.includes(input.applicantId)) throw new Error("APPLICANT_OWNERSHIP_MISMATCH");
      const document = draft.documents.find((item) => item.documentId === input.documentId && item.applicantId === input.applicantId);
      if (!document) throw new Error("DOCUMENT_OWNERSHIP_MISMATCH");
      if (document.version !== input.expectedDocumentVersion) throw new Error("STALE_DOCUMENT_VERSION");
      return { details: { applicantId: input.applicantId, documentId: input.documentId, documentVersion: document.version, outcome: input.outcome } };
    },
  });
}

type Assignee = { id: string; active: boolean; teamIds: ReadonlySet<number>; workloadLimit: number };

export function assignCase(input: Common & {
  mode: "ASSIGN" | "CLAIM" | "REASSIGN";
  assignee: Assignee;
  reason: string;
}, deps: Dependencies): WriteResult {
  gate(input, input.mode === "CLAIM" ? "case.read_assigned" : "case.assign");
  const reason = requireReason(input.reason);
  return input.repository.apply({
    ...input, auditEventId: deps.newId(), action: input.mode, actorId: input.actor.id, reason,
    occurredAt: deps.now().toISOString(), fingerprint: fingerprint({ action: input.mode, assigneeId: input.assignee.id, reason }),
    mutate: (draft) => {
      assertNonTerminal(draft.status);
      if (!input.assignee.active) throw new Error("ASSIGNEE_INACTIVE");
      if (input.mode === "CLAIM" && input.assignee.id !== input.actor.id) throw new Error("CLAIM_MUST_TARGET_ACTOR");
      if (draft.teamId === undefined || !input.assignee.teamIds.has(draft.teamId)) throw new Error("ASSIGNEE_TEAM_SCOPE_MISMATCH");
      if (input.repository.workload(input.assignee.id) >= input.assignee.workloadLimit) throw new Error("ASSIGNEE_WORKLOAD_LIMIT_REACHED");
      if (draft.assignedActorId === input.assignee.id) throw new Error("ASSIGNEE_ALREADY_ASSIGNED");
      if (input.mode === "ASSIGN" && draft.assignedActorId) throw new Error("CASE_ALREADY_ASSIGNED");
      if (input.mode === "CLAIM" && draft.assignedActorId && draft.assignedActorId !== input.actor.id) throw new Error("ASSIGNMENT_COLLISION");
      if (input.mode === "REASSIGN" && !draft.assignedActorId) throw new Error("CASE_IS_NOT_ASSIGNED");
      const previous = draft.assignedActorId;
      draft.assignedActorId = input.assignee.id;
      return { details: { previousAssigneeId: previous ?? null, assigneeId: input.assignee.id }, workloadChange: { from: previous, to: input.assignee.id } };
    },
  });
}

export function transitionCaseStatus(input: Common & { to: ApplicationStatus; reason: string }, deps: Dependencies): WriteResult {
  gate(input, "case.transition");
  const reason = requireReason(input.reason);
  return input.repository.apply({
    ...input, auditEventId: deps.newId(), action: "STATUS_TRANSITION", actorId: input.actor.id, reason,
    occurredAt: deps.now().toISOString(), fingerprint: fingerprint({ action: "STATUS_TRANSITION", to: input.to, reason }),
    mutate: (draft) => {
      const from = draft.status;
      assertControlledTransition(from, input.to);
      draft.status = input.to;
      return { details: { from, to: input.to } };
    },
  });
}

export function requestReevaluation(input: Common & {
  snapshots: InMemoryEligibilitySnapshotRepository;
  applicantId: number;
  expectedCurrentEvaluationId: string;
  selectedRoute: string;
  profile: EligibilityProfile;
  rules: readonly EligibilityRule[];
  reason: string;
}, deps: Dependencies): WriteResult {
  gate(input, "rule.review");
  const reason = requireReason(input.reason);
  const evaluatedAt = deps.now();
  const evaluationId = deps.newId();
  const selectionId = deps.newId();
  const result = evaluateEligibility({ profile: input.profile, rules: input.rules, evaluatedAt });
  return input.repository.apply({
    ...input, auditEventId: deps.newId(), action: "REEVALUATION_REQUEST", actorId: input.actor.id, reason,
    occurredAt: evaluatedAt.toISOString(), fingerprint: fingerprint({ action: "REEVALUATION_REQUEST", applicantId: input.applicantId, expectedCurrentEvaluationId: input.expectedCurrentEvaluationId, selectedRoute: input.selectedRoute, reason }),
    mutate: (draft) => {
      assertNonTerminal(draft.status);
      if (!draft.applicantIds.includes(input.applicantId)) throw new Error("APPLICANT_OWNERSHIP_MISMATCH");
      const current = input.snapshots.current(input.applicationId, input.applicantId);
      if (!current || current.evaluationId !== input.expectedCurrentEvaluationId) throw new Error("STALE_EVALUATION_SELECTION");
      const snapshot = createEvaluationEvidence({ evaluationId, applicationId: input.applicationId, applicantId: input.applicantId, selectedRoute: input.selectedRoute, evaluatedAt, result, supersedesEvaluationId: current.evaluationId, reevaluationReason: reason });
      input.snapshots.append(snapshot);
      input.snapshots.select({ id: selectionId, applicationId: input.applicationId, applicantId: input.applicantId, evaluationId, reason, selectedBy: input.actor.id, selectedAt: evaluatedAt.toISOString() });
      return { details: { applicantId: input.applicantId, previousEvaluationId: current.evaluationId, evaluationId, eligibilityState: snapshot.eligibilityState } };
    },
  });
}
