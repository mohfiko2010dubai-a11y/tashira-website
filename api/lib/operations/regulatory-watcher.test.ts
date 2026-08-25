import { describe, expect, it } from "vitest";
import { proposeRegulatoryChange } from "./regulatory-watcher";

const previous = { sourceId: "source-1", authority: "Official Authority", sourceUrl: "https://official.example/rules", retrievedAt: "2026-08-24T00:00:00Z", normalizedContent: "Passport required" };

describe("regulatory watcher proposal workflow", () => {
  it("creates a review-only proposal with impact references", () => {
    expect(proposeRegulatoryChange({ proposalId: "proposal-1", previous, current: { ...previous, retrievedAt: "2026-08-25T00:00:00Z", normalizedContent: "Passport and photo required" }, affectedActiveApplicationIds: [3, 2, 3] })).toMatchObject({
      state: "PROPOSED", requiresAuthorizedHumanReview: true, automaticActivationAllowed: false, affectedActiveApplicationIds: [3, 2],
    });
  });

  it("does nothing when normalized official content is unchanged", () => {
    expect(proposeRegulatoryChange({ proposalId: "proposal-2", previous, current: { ...previous, retrievedAt: "2026-08-25T00:00:00Z", normalizedContent: "  Passport   required " }, affectedActiveApplicationIds: [] })).toBeNull();
  });

  it("rejects cross-source comparison and non-HTTPS evidence", () => {
    expect(() => proposeRegulatoryChange({ proposalId: "x", previous, current: { ...previous, sourceId: "other" }, affectedActiveApplicationIds: [] })).toThrow("REGULATORY_SOURCE_MISMATCH");
    expect(() => proposeRegulatoryChange({ proposalId: "x", previous, current: { ...previous, sourceUrl: "http://unsafe.example" }, affectedActiveApplicationIds: [] })).toThrow("REGULATORY_SOURCE_INVALID");
  });
});
