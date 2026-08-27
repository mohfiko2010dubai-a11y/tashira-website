import { describe, expect, it } from "vitest";
import { routeDocumentIntelligence } from "./routing";

const base = { hasMachineReadableZone: true, knownPassportProfile: true, ocrConfidence: 0.98, profileConfidenceThreshold: 0.9,
  materialConflict: false, unreadable: false, requiredFieldMissing: false, advancedProviderAvailable: true,
  estimatedCosts: { DETERMINISTIC: 0, MRZ: 0, LOW_COST_OCR: 0.01, PROFILE_MAPPING: 0, ADVANCED_AI: 0.2, HUMAN_REVIEW: 2 } } as const;

describe("cost-aware document intelligence routing", () => {
  it("keeps a clean known TD3 document on the cheap path", () => {
    expect(routeDocumentIntelligence(base)).toEqual({ tiers: ["DETERMINISTIC", "MRZ", "LOW_COST_OCR", "PROFILE_MAPPING"],
      finalTier: "PROFILE_MAPPING", escalationReasons: [], estimatedCost: 0.01, requiresHumanReview: false });
  });

  it("escalates low OCR confidence to the advanced provider with explicit cost", () => {
    expect(routeDocumentIntelligence({ ...base, ocrConfidence: 0.5 })).toMatchObject({ finalTier: "ADVANCED_AI",
      escalationReasons: ["OCR_CONFIDENCE_BELOW_THRESHOLD"], estimatedCost: 0.21, requiresHumanReview: false });
  });

  it("routes unresolved unknown layout to Human Review when no advanced provider exists", () => {
    expect(routeDocumentIntelligence({ ...base, hasMachineReadableZone: false, knownPassportProfile: false,
      advancedProviderAvailable: false })).toMatchObject({ finalTier: "HUMAN_REVIEW", requiresHumanReview: true,
      escalationReasons: ["UNKNOWN_PASSPORT_LAYOUT"] });
  });

  it("never lets advanced AI silently resolve an identity conflict", () => {
    const result = routeDocumentIntelligence({ ...base, materialConflict: true });
    expect(result.tiers).toEqual(["DETERMINISTIC", "MRZ", "LOW_COST_OCR", "PROFILE_MAPPING", "ADVANCED_AI", "HUMAN_REVIEW"]);
    expect(result).toMatchObject({ finalTier: "HUMAN_REVIEW", requiresHumanReview: true, escalationReasons: ["IDENTITY_DATA_CONFLICT"] });
  });
});

