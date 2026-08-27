import { describe, expect, it } from "vitest";
import { validateProviderResult, type CanonicalDocumentIntelligenceResult } from "./provider";
const result: CanonicalDocumentIntelligenceResult = { documentType: "PASSPORT", detectedCountry: "EGY", passportProfileId: "profile-v1",
  passportProfileVersion: 1, fields: [{ fieldCode: "passport_number", value: "A123", sourceType: "PASSPORT_MRZ", confidence: 0.99 }],
  rawTextReference: "sha256:synthetic", confidence: 0.99, warnings: [], mismatches: [], provider: "SYNTHETIC_PROVIDER",
  modelVersion: "v1", processingCost: 0.01, processingCurrency: "USD", escalationReason: null, processingTimestamp: "2026-08-27T00:00:00Z" };
describe("provider-neutral result contract", () => {
  it("accepts normalized provider output without provider-specific payloads", () => expect(validateProviderResult(result)).toEqual(result));
  it("rejects duplicate fields and invalid cost", () => {
    expect(() => validateProviderResult({ ...result, fields: [...result.fields, ...result.fields] })).toThrow("DOCUMENT_PROVIDER_FIELD_DUPLICATE");
    expect(() => validateProviderResult({ ...result, processingCost: -1 })).toThrow("DOCUMENT_PROVIDER_COST_INVALID");
  });
});

