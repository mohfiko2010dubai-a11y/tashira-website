import { describe, expect, it } from "vitest";

import {
  MAX_DOCUMENT_FILE_SIZE,
  sanitizeDocumentFileName,
  validateDocumentFile,
} from "./document-upload";

describe("document upload policy", () => {
  it("removes paths and unsafe filename characters", () => {
    expect(sanitizeDocumentFileName("../../passport (final)#.pdf")).toBe("passport final.pdf");
    expect(sanitizeDocumentFileName("folder\\photo.png")).toBe("photo.png");
  });

  it("accepts supported files with matching decoded size", () => {
    expect(validateDocumentFile("application/pdf", 12, 12)).toBeNull();
    expect(validateDocumentFile("image/jpeg", 24, 24)).toBeNull();
  });

  it("rejects unsupported, oversized, empty, and size-mismatched files", () => {
    expect(validateDocumentFile("text/html", 12, 12)).toContain("not allowed");
    expect(validateDocumentFile("image/png", 0, 0)).toContain("between");
    expect(validateDocumentFile("image/png", MAX_DOCUMENT_FILE_SIZE + 1)).toContain("between");
    expect(validateDocumentFile("image/png", 10, 9)).toContain("does not match");
  });
});
