export type DocumentPrescreeningInput = {
  applicationId: number;
  applicantId: number;
  documentId: number;
  expectedDocumentType: string;
  detectedDocumentType: string | null;
  confidence: number;
  unreadableReasons: readonly string[];
  extractedFields: Readonly<Record<string, string>>;
  authoritativeApplicantFields: Readonly<Record<string, string>>;
  evidenceReferences: readonly string[];
  providerReference: string;
  modelVersion: string;
};

export type DocumentPrescreeningResult = {
  applicationId: number;
  applicantId: number;
  documentId: number;
  classification: "LIKELY_MATCH" | "LIKELY_MISMATCH" | "UNREADABLE" | "LOW_CONFIDENCE";
  confidence: number;
  reasons: readonly string[];
  fieldMismatches: readonly string[];
  evidenceReferences: readonly string[];
  requiresHumanReview: true;
  finalDecisionAuthority: "HUMAN";
  providerReference: string;
  modelVersion: string;
};

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("en");
}

export function prescreenDocument(input: DocumentPrescreeningInput): DocumentPrescreeningResult {
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error("DOCUMENT_PRESCREEN_CONFIDENCE_INVALID");
  }
  if (!input.providerReference.trim() || !input.modelVersion.trim() || input.evidenceReferences.length === 0) {
    throw new Error("DOCUMENT_PRESCREEN_EVIDENCE_REQUIRED");
  }

  const reasons: string[] = [];
  const fieldMismatches = Object.entries(input.authoritativeApplicantFields).flatMap(([field, expected]) => {
    const extracted = input.extractedFields[field];
    if (!extracted || normalized(extracted) === normalized(expected)) return [];
    return [field];
  });
  let classification: DocumentPrescreeningResult["classification"] = "LIKELY_MATCH";

  if (input.unreadableReasons.length > 0) {
    classification = "UNREADABLE";
    reasons.push(...input.unreadableReasons.map((reason) => `UNREADABLE:${reason}`));
  } else if (input.detectedDocumentType !== null && normalized(input.detectedDocumentType) !== normalized(input.expectedDocumentType)) {
    classification = "LIKELY_MISMATCH";
    reasons.push("DOCUMENT_TYPE_MISMATCH");
  } else if (fieldMismatches.length > 0) {
    classification = "LIKELY_MISMATCH";
    reasons.push("APPLICANT_FIELD_MISMATCH");
  } else if (input.confidence < 0.9) {
    classification = "LOW_CONFIDENCE";
    reasons.push("CONFIDENCE_BELOW_REVIEW_THRESHOLD");
  } else {
    reasons.push("NO_AUTOMATED_CONCERN_DETECTED");
  }

  return {
    applicationId: input.applicationId,
    applicantId: input.applicantId,
    documentId: input.documentId,
    classification,
    confidence: input.confidence,
    reasons,
    fieldMismatches,
    evidenceReferences: [...input.evidenceReferences],
    requiresHumanReview: true,
    finalDecisionAuthority: "HUMAN",
    providerReference: input.providerReference,
    modelVersion: input.modelVersion,
  };
}
