import { describe, expect, it } from "vitest";
import { prepareVisaDelivery } from "./visa-delivery";
const base = { deliveryId: "delivery-1", applicationId: 1, applicantId: 2, visaDocumentId: 10, generatedAt: "2026-08-25T12:00:00Z", recipientReference: "customer-session:synthetic", authorizedCustomer: true, virusScanPassed: true, documentOwnershipVerified: true, visaReference: "SYNTHETIC-VISA", validitySummary: "Verify dates shown on the visa", customerInstructions: ["Check all details"], evidenceReferences: ["document:10", "status:issued"] };
describe("visa delivery", () => {
  it("prepares only an authorized, ownership-verified secure package", () => expect(prepareVisaDelivery(base)).toMatchObject({ state: "READY_FOR_SECURE_DELIVERY", applicantId: 2 }));
  it("rejects wrong ownership and unauthorized access", () => { expect(() => prepareVisaDelivery({ ...base, documentOwnershipVerified: false })).toThrow("VISA_DELIVERY_DOCUMENT_NOT_SAFE"); expect(() => prepareVisaDelivery({ ...base, authorizedCustomer: false })).toThrow("VISA_DELIVERY_CUSTOMER_AUTHORIZATION_REQUIRED"); });
});
