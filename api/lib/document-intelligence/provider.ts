import type { AuthorityFieldSourceType } from "./contracts";

export type ProviderField = { fieldCode: string; value: string; sourceType: AuthorityFieldSourceType; confidence: number;
  rawLabel?: string; rawValue?: string; boundingReference?: string };
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

export type DocumentReferenceInput = { documentReference: string; mimeType: string; pageCount: number };
export type DocumentClassification = { documentType: "PASSPORT" | "RESIDENCE" | "NATIONAL_ID" | "TICKET" | "UNKNOWN"; confidence: number; detectedCountry: string | null };
export type TextExtraction = { rawTextReference: string; confidence: number; pageCount: number };

export interface CanonicalDocumentIntelligenceAdapter {
  readonly providerCode: string;
  classifyDocument(input: DocumentReferenceInput): Promise<DocumentClassification>;
  extractText(input: DocumentReferenceInput): Promise<TextExtraction>;
  extractStructuredFields(input: DocumentReferenceInput & { expectedFieldCodes: readonly string[] }): Promise<CanonicalDocumentIntelligenceResult>;
  analyzePassport(input: DocumentReferenceInput & { passportProfileId: string | null }): Promise<CanonicalDocumentIntelligenceResult>;
  analyzeResidence(input: DocumentReferenceInput): Promise<CanonicalDocumentIntelligenceResult>;
  analyzeNationalId(input: DocumentReferenceInput): Promise<CanonicalDocumentIntelligenceResult>;
  analyzeTicket(input: DocumentReferenceInput): Promise<CanonicalDocumentIntelligenceResult>;
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
    if (field.rawLabel !== undefined && (!field.rawLabel.trim() || field.rawLabel.length > 500)
      || field.rawValue !== undefined && (!field.rawValue.trim() || field.rawValue.length > 2_000)
      || field.boundingReference !== undefined && (!field.boundingReference.trim() || field.boundingReference.length > 500)) {
      throw new Error("DOCUMENT_PROVIDER_VISUAL_EVIDENCE_INVALID");
    }
  }
  return structuredClone(result);
}
