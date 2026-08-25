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
    expect(prescreenDocument({ ...base, unreadableReasons: ["GLARE"] }).classification).toBe("UNREADABLE");
    expect(prescreenDocument({ ...base, confidence: 0.55 }).classification).toBe("LOW_CONFIDENCE");
  });

  it("rejects missing evidence and invalid confidence", () => {
    expect(() => prescreenDocument({ ...base, evidenceReferences: [] })).toThrow("DOCUMENT_PRESCREEN_EVIDENCE_REQUIRED");
    expect(() => prescreenDocument({ ...base, confidence: 2 })).toThrow("DOCUMENT_PRESCREEN_CONFIDENCE_INVALID");
  });
});
