import type { AuthorityFieldSourceType } from "./contracts";

export type ProviderField = { fieldCode: string; value: string; sourceType: AuthorityFieldSourceType; confidence: number };
export type CanonicalDocumentIntelligenceResult = {
  documentType: string;
  detectedCountry: string | null;
  passportProfileId: string | null;
  passportProfileVersion: number | null;
  fields: readonly ProviderField[];
  rawTextReference: string | null;
  confidence: number;
  warnings: readonly string[];
  mismatches: readonly string[];
  provider: string;
  modelVersion: string;
  processingCost: number;
  processingCurrency: string;
  escalationReason: string | null;
  processingTimestamp: string;
};

export interface DocumentIntelligenceProvider {
  readonly providerCode: string;
  extract(input: { documentReference: string; mimeType: string; pageCount: number }): Promise<CanonicalDocumentIntelligenceResult>;
}

export function validateProviderResult(result: CanonicalDocumentIntelligenceResult): CanonicalDocumentIntelligenceResult {
  if (!result.documentType.trim() || !result.provider.trim() || !result.modelVersion.trim()) throw new Error("DOCUMENT_PROVIDER_IDENTITY_INVALID");
  if (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) throw new Error("DOCUMENT_PROVIDER_CONFIDENCE_INVALID");
  if (!Number.isFinite(result.processingCost) || result.processingCost < 0) throw new Error("DOCUMENT_PROVIDER_COST_INVALID");
  if (!/^[A-Z]{3}$/.test(result.processingCurrency) || Number.isNaN(Date.parse(result.processingTimestamp))) throw new Error("DOCUMENT_PROVIDER_METADATA_INVALID");
  const fieldCodes = result.fields.map((field) => field.fieldCode);
  if (new Set(fieldCodes).size !== fieldCodes.length) throw new Error("DOCUMENT_PROVIDER_FIELD_DUPLICATE");
  for (const field of result.fields) {
    if (!field.fieldCode.trim() || !field.value.trim() || !Number.isFinite(field.confidence) || field.confidence < 0 || field.confidence > 1) {
      throw new Error("DOCUMENT_PROVIDER_FIELD_INVALID");
    }
  }
  return structuredClone(result);
}

