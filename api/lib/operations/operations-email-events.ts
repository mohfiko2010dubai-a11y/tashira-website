export type OperationsEmailEvent = "APPLICATION_RECEIVED" | "PAYMENT_CONFIRMED" | "DOCUMENTS_UNDER_REVIEW" | "MISSING_DOCUMENTS" | "DOCUMENTS_COMPLETE" | "APPLICATION_SCHEDULED_FOR_SUBMISSION" | "TRAVEL_DATE_CHANGED" | "SUBMISSION_DELAYED_BY_MISSING_DOCUMENT" | "APPLICATION_READY_FOR_SUBMISSION" | "SUBMITTED_TO_AUTHORITY" | "UNDER_AUTHORITY_REVIEW" | "ADDITIONAL_INFORMATION_REQUIRED" | "APPROVED" | "VISA_ISSUED" | "REJECTED" | "REFUND_PENDING" | "REFUNDED";
export type OperationsEmailEvidence = { evidenceId: string; applicationId: number; event: OperationsEmailEvent; eventReference: string; templateVersion: string; recipientReference: string; providerMessageId: string | null; deliveryStatus: "QUEUED" | "SENT" | "FAILED"; occurredAt: string; deduplicationKey: string };

export class OperationsEmailLedger {
  readonly #byDeduplicationKey = new Map<string, OperationsEmailEvidence>();
  record(evidence: OperationsEmailEvidence): "RECORDED" | "DUPLICATE" {
    if (!evidence.evidenceId.trim() || !evidence.eventReference.trim() || !evidence.templateVersion.trim() || !evidence.recipientReference.trim() || Number.isNaN(Date.parse(evidence.occurredAt))) throw new Error("OPERATIONS_EMAIL_EVIDENCE_REQUIRED");
    const existing = this.#byDeduplicationKey.get(evidence.deduplicationKey);
    if (existing) return "DUPLICATE";
    this.#byDeduplicationKey.set(evidence.deduplicationKey, { ...evidence });
    return "RECORDED";
  }
  application(applicationId: number): readonly OperationsEmailEvidence[] { return [...this.#byDeduplicationKey.values()].filter((item) => item.applicationId === applicationId).map((item) => ({ ...item })); }
}
