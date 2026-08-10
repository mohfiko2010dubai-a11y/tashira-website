export function documentUploadEvent(documentType: string): "PASSPORT_UPLOADED" | "PHOTO_UPLOADED" | "SUPPORTING_DOCUMENT_UPLOADED" | "DOCUMENT_UPLOADED" {
  if (documentType === "passport") return "PASSPORT_UPLOADED";
  if (documentType === "photo") return "PHOTO_UPLOADED";
  if (documentType === "supporting") return "SUPPORTING_DOCUMENT_UPLOADED";
  return "DOCUMENT_UPLOADED";
}

export function sanitizePaymentFailureCategory(value?: string) {
  const normalized = (value || "unknown").toLowerCase();
  const allowed = ["card_declined", "authentication_failed", "processing_error", "network_error", "cancelled", "unknown"];
  return allowed.includes(normalized) ? normalized : "unknown";
}
