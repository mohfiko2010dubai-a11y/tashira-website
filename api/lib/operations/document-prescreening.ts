import { authorizeAiAdvisoryTask } from "../ai/decision-boundary";

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
  providerName?: string;
  processedAt?: string;
  missingPages?: readonly string[];
  documentExpiryDate?: string | null;
  evaluatedAt?: string;
  ticketPassengerNames?: readonly string[];
  authoritativeApplicantNames?: readonly string[];
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
  providerName: string;
  processedAt: string;
  outcome: "PASS" | "WARNING" | "MISSING" | "MISMATCH" | "UNREADABLE" | "MANUAL_REVIEW";
  missingFields: readonly string[];
  missingPages: readonly string[];
  ticketPassengerMismatches: readonly string[];
};

function normalized(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("en");
}

export function prescreenDocument(input: DocumentPrescreeningInput): DocumentPrescreeningResult {
  authorizeAiAdvisoryTask("DOCUMENT_PRESCREEN");
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error("DOCUMENT_PRESCREEN_CONFIDENCE_INVALID");
  }
  if (!input.providerReference.trim() || !input.modelVersion.trim() || input.evidenceReferences.length === 0) {
    throw new Error("DOCUMENT_PRESCREEN_EVIDENCE_REQUIRED");
  }

  const reasons: string[] = [];
  const processedAt = input.processedAt ?? new Date(0).toISOString();
  if (Number.isNaN(Date.parse(processedAt))) throw new Error("DOCUMENT_PRESCREEN_TIMESTAMP_INVALID");
  const missingFields = Object.keys(input.authoritativeApplicantFields)
    .filter((field) => !input.extractedFields[field]?.trim())
    .sort();
  const missingPages = [...new Set(input.missingPages ?? [])].sort();
  const fieldMismatches = Object.entries(input.authoritativeApplicantFields).flatMap(([field, expected]) => {
    const extracted = input.extractedFields[field];
    if (!extracted || normalized(extracted) === normalized(expected)) return [];
    return [field];
  });
  let classification: DocumentPrescreeningResult["classification"] = "LIKELY_MATCH";
  let outcome: DocumentPrescreeningResult["outcome"] = "PASS";
  const expectedNames = new Set((input.authoritativeApplicantNames ?? []).map(normalized));
  const ticketPassengerMismatches = (input.ticketPassengerNames ?? [])
    .filter((name) => !expectedNames.has(normalized(name)))
    .sort();

  if (input.unreadableReasons.length > 0) {
    classification = "UNREADABLE";
    outcome = "UNREADABLE";
    reasons.push(...input.unreadableReasons.map((reason) => `UNREADABLE:${reason}`));
  } else if (missingPages.length > 0 || missingFields.length > 0) {
    classification = "LOW_CONFIDENCE";
    outcome = "MISSING";
    reasons.push(...missingPages.map((page) => `MISSING_PAGE:${page}`), ...missingFields.map((field) => `MISSING_FIELD:${field}`));
  } else if (input.detectedDocumentType !== null && normalized(input.detectedDocumentType) !== normalized(input.expectedDocumentType)) {
    classification = "LIKELY_MISMATCH";
    outcome = "MISMATCH";
    reasons.push("DOCUMENT_TYPE_MISMATCH");
  } else if (fieldMismatches.length > 0) {
    classification = "LIKELY_MISMATCH";
    outcome = "MISMATCH";
    reasons.push("APPLICANT_FIELD_MISMATCH");
  } else if (ticketPassengerMismatches.length > 0) {
    classification = "LIKELY_MISMATCH";
    outcome = "MISMATCH";
    reasons.push("TICKET_PASSENGER_MISMATCH");
  } else if (input.documentExpiryDate && input.evaluatedAt
    && Date.parse(input.documentExpiryDate) < Date.parse(input.evaluatedAt)) {
    classification = "LIKELY_MISMATCH";
    outcome = "MISMATCH";
    reasons.push("DOCUMENT_EXPIRED");
  } else if (input.confidence < 0.9) {
    classification = "LOW_CONFIDENCE";
    outcome = "WARNING";
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
    providerName: input.providerName?.trim() || "UNCONFIGURED_TEST_PROVIDER",
    processedAt,
    outcome,
    missingFields,
    missingPages,
    ticketPassengerMismatches,
  };
}
