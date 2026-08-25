import { createHash } from "node:crypto";

export type VisaDeliveryPackage = {
  deliveryId: string; applicationId: number; applicantId: number; visaDocumentId: number; generatedAt: string;
  recipientReference: string; authorizedCustomer: boolean; virusScanPassed: boolean; documentOwnershipVerified: boolean;
  visaReference: string; validitySummary: string; customerInstructions: readonly string[]; evidenceReferences: readonly string[];
  state: "READY_FOR_SECURE_DELIVERY"; integritySha256: string;
};

export function prepareVisaDelivery(input: Omit<VisaDeliveryPackage, "state" | "integritySha256">): VisaDeliveryPackage {
  if (!input.authorizedCustomer) throw new Error("VISA_DELIVERY_CUSTOMER_AUTHORIZATION_REQUIRED");
  if (!input.virusScanPassed || !input.documentOwnershipVerified) throw new Error("VISA_DELIVERY_DOCUMENT_NOT_SAFE");
  if (!input.deliveryId.trim() || !input.recipientReference.trim() || !input.visaReference.trim() || input.evidenceReferences.length === 0) throw new Error("VISA_DELIVERY_EVIDENCE_REQUIRED");
  if (Number.isNaN(Date.parse(input.generatedAt))) throw new Error("VISA_DELIVERY_TIMESTAMP_INVALID");
  const canonical = { ...input, customerInstructions: [...input.customerInstructions], evidenceReferences: [...new Set(input.evidenceReferences)].sort() };
  return { ...canonical, state: "READY_FOR_SECURE_DELIVERY", integritySha256: createHash("sha256").update(JSON.stringify(canonical)).digest("hex") };
}
