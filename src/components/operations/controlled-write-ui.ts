import type { ApplicationStatus, DocumentReviewOutcome, HumanReviewOutcome } from "../../../api/lib/operations/controlled-write-repository";

export type ControlledWriteCommand =
  | { action: "HUMAN_REVIEW"; outcome: HumanReviewOutcome; reason: string; idempotencyKey: string }
  | { action: "DOCUMENT_REVIEW"; applicantId: number; documentId: number; expectedDocumentVersion: number; outcome: DocumentReviewOutcome; reason: string; idempotencyKey: string }
  | { action: "ASSIGNMENT"; mode: "ASSIGN" | "CLAIM" | "REASSIGN"; assigneeId: string; reason: string; idempotencyKey: string }
  | { action: "STATUS_TRANSITION"; to: ApplicationStatus; reason: string; idempotencyKey: string }
  | { action: "REEVALUATION_REQUEST"; applicantId: number; expectedCurrentEvaluationId: string; reason: string; idempotencyKey: string };

export function controlledWriteErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const code = ["UNAUTHENTICATED", "FORBIDDEN", "OUT_OF_SCOPE", "INVALID_STATE_TRANSITION", "PRECONDITION_FAILED", "CONCURRENCY_CONFLICT", "IDEMPOTENCY_CONFLICT", "FEATURE_DISABLED", "MANUAL_REVIEW_REQUIRED"]
    .find((candidate) => message.includes(candidate));
  if (code === "UNAUTHENTICATED") return "Your session is no longer valid. Sign in again before continuing.";
  if (code === "FORBIDDEN" || code === "OUT_OF_SCOPE") return "You do not have permission for this case or action.";
  if (code === "INVALID_STATE_TRANSITION") return "The case state changed. Refresh the latest case before choosing another transition.";
  if (code === "PRECONDITION_FAILED") return "This action cannot continue until its required prerequisites are complete.";
  if (code === "CONCURRENCY_CONFLICT") return "This case was updated by another user. Refresh the latest version before continuing.";
  if (code === "IDEMPOTENCY_CONFLICT") return "This action reference was already used for different data. Review the latest case; it was not retried.";
  if (code === "FEATURE_DISABLED") return "Controlled write mode is currently disabled.";
  if (code === "MANUAL_REVIEW_REQUIRED") return "This case requires the authorized manual-review workflow.";
  return "The action was not completed. Refresh the case and try again, or contact an Operations Manager.";
}

export function newControlledWriteKey(randomId: () => string = () => globalThis.crypto.randomUUID()): string {
  return `ops-${randomId()}`;
}

export function resolveControlledWriteKey(current: string | null, randomId?: () => string): string {
  return current ?? newControlledWriteKey(randomId);
}
