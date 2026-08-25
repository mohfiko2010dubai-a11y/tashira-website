import { describe, expect, it } from "vitest";
import { prescreenDocument } from "./document-prescreening";

const base = {
  applicationId: 1, applicantId: 11, documentId: 111, expectedDocumentType: "PASSPORT",
  detectedDocumentType: "PASSPORT", confidence: 0.97, unreadableReasons: [],
  extractedFields: { fullName: "MAYA HASSAN" }, authoritativeApplicantFields: { fullName: "Maya Hassan" },
  evidenceReferences: ["sha256:synthetic"], providerReference: "provider:test", modelVersion: "test-v1",
} as const;

describe("provider-independent document pre-screening", () => {
  it("keeps a likely match subject to human decision", () => {
    expect(prescreenDocument(base)).toMatchObject({ classification: "LIKELY_MATCH", requiresHumanReview: true, finalDecisionAuthority: "HUMAN" });
  });

  it("detects applicant-scoped mismatches without making a final decision", () => {
    expect(prescreenDocument({ ...base, extractedFields: { fullName: "OTHER PERSON" } })).toMatchObject({
      classification: "LIKELY_MISMATCH", fieldMismatches: ["fullName"], finalDecisionAuthority: "HUMAN",
    });
  });

  it("fails unreadable and low-confidence evidence to review", () => {
    expect(prescreenDocument({ ...base, unreadableReasons: ["GLARE"] })).toMatchObject({ classification: "UNREADABLE", outcome: "UNREADABLE" });
    expect(prescreenDocument({ ...base, confidence: 0.55 })).toMatchObject({ classification: "LOW_CONFIDENCE", outcome: "WARNING" });
  });

  it("detects missing pages, expiry, document numbers and ticket passenger mismatches", () => {
    expect(prescreenDocument({ ...base, missingPages: ["BIO_PAGE"] })).toMatchObject({ outcome: "MISSING", missingPages: ["BIO_PAGE"] });
    expect(prescreenDocument({ ...base, documentExpiryDate: "2026-01-01", evaluatedAt: "2026-08-25" })).toMatchObject({ outcome: "MISMATCH", reasons: ["DOCUMENT_EXPIRED"] });
    expect(prescreenDocument({ ...base, extractedFields: { fullName: "MAYA HASSAN", passportNumber: "B" }, authoritativeApplicantFields: { fullName: "MAYA HASSAN", passportNumber: "A" } })).toMatchObject({ outcome: "MISMATCH", fieldMismatches: ["passportNumber"] });
    expect(prescreenDocument({ ...base, ticketPassengerNames: ["OTHER PERSON"], authoritativeApplicantNames: ["MAYA HASSAN"] })).toMatchObject({ outcome: "MISMATCH", ticketPassengerMismatches: ["OTHER PERSON"] });
  });

  it("records provider/model metadata while retaining human authority", () => {
    expect(prescreenDocument({ ...base, providerName: "SYNTHETIC", processedAt: "2026-08-25T12:00:00Z" })).toMatchObject({ providerName: "SYNTHETIC", processedAt: "2026-08-25T12:00:00Z", outcome: "PASS", finalDecisionAuthority: "HUMAN" });
  });

  it("rejects missing evidence and invalid confidence", () => {
    expect(() => prescreenDocument({ ...base, evidenceReferences: [] })).toThrow("DOCUMENT_PRESCREEN_EVIDENCE_REQUIRED");
    expect(() => prescreenDocument({ ...base, confidence: 2 })).toThrow("DOCUMENT_PRESCREEN_CONFIDENCE_INVALID");
  });
});
