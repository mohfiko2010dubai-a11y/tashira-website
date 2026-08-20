const PAID_ONLY_APPLICATION_STATES = new Set([
  "payment_received",
  "documents_received",
  "under_review",
  "visa_processing",
  "visa_received",
  "completed",
]);

export function canEnterApplicationState(paymentStatus: string, nextStatus: string) {
  return paymentStatus === "paid" || !PAID_ONLY_APPLICATION_STATES.has(nextStatus);
}
