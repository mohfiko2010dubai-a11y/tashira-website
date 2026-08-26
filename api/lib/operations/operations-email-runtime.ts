import type {
  FeatureFlagContext,
  FeatureFlagRecord,
} from "../feature-flags/feature-flags";
import { isOperationsFlagEnabled } from "../feature-flags/feature-flags";
import type { OperationsEmailEvidence } from "./operations-email-events";
import type {
  OperationsEmailRepository,
  QueueOperationsEmailInput,
} from "./mysql-operations-email-repository";

export async function queueOperationsEmailBehindFlag(
  input: QueueOperationsEmailInput & {
    context: FeatureFlagContext;
    flags: readonly FeatureFlagRecord[];
    repository: OperationsEmailRepository;
  }
): Promise<OperationsEmailEvidence | null> {
  if (
    !isOperationsFlagEnabled(
      "OPERATIONS_EMAIL_AUTOMATION",
      input.context,
      input.flags
    )
  )
    return null;
  if (
    !input.templateVersion.trim() ||
    !input.deduplicationKey.trim() ||
    Number.isNaN(Date.parse(input.occurredAt))
  ) {
    throw new Error("OPERATIONS_EMAIL_QUEUE_EVIDENCE_REQUIRED");
  }
  return input.repository.queue({
    timelineEventId: input.timelineEventId,
    event: input.event,
    templateVersion: input.templateVersion,
    deduplicationKey: input.deduplicationKey,
    occurredAt: input.occurredAt,
  });
}
