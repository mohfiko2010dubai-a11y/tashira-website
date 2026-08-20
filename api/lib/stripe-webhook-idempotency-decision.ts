const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export type StripeWebhookProcessingStatus = "processing" | "processed" | "failed";

export function canProcessStripeWebhook(
  status: StripeWebhookProcessingStatus | null,
  updatedAt: Date | null,
  now = new Date(),
): boolean {
  if (status === null || status === "failed") return true;
  if (status === "processed") return false;
  return updatedAt !== null && now.getTime() - updatedAt.getTime() >= PROCESSING_LEASE_MS;
}
