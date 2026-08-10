import { describe, expect, it } from "vitest";
import { hashEvidenceManifest } from "./evidence-integrity";
import { documentUploadEvent, sanitizePaymentFailureCategory } from "./timeline-safety";

describe("timeline evidence safety", () => {
  it("maps document types without retaining file content", () => {
    expect(documentUploadEvent("passport")).toBe("PASSPORT_UPLOADED");
    expect(documentUploadEvent("photo")).toBe("PHOTO_UPLOADED");
    expect(documentUploadEvent("supporting")).toBe("SUPPORTING_DOCUMENT_UPLOADED");
  });

  it("allowlists failure categories and discards arbitrary provider text", () => {
    expect(sanitizePaymentFailureCategory("card_declined")).toBe("card_declined");
    expect(sanitizePaymentFailureCategory("card 4242 failed with secret payload")).toBe("unknown");
  });

  it("produces a deterministic SHA-256 integrity indicator", () => {
    const hash = hashEvidenceManifest({ application: "TSH-TEST", events: ["PAYMENT_CONFIRMED"] });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashEvidenceManifest({ application: "TSH-TEST", events: ["PAYMENT_CONFIRMED"] })).toBe(hash);
  });
});
