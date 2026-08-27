import { describe, expect, it } from "vitest";
import type { PassportProfile } from "./contracts";
import { PassportProfileRegistry } from "./profile-registry";

function profile(overrides: Partial<PassportProfile> = {}): PassportProfile {
  return { profileId: "STAGING_TEST_EGYPT_TD3", version: 1, issuingCountry: "EGY", passportType: "P", layoutVersion: "synthetic-v1",
    expectedVisibleFields: ["passport_visual_full_name"], optionalVisibleFields: [], labelAliases: {}, mrzType: "TD3",
    expectedMrzFields: ["passport_number"], languages: ["ar", "en"], nameStructure: "SURNAME_GIVEN_NAMES",
    legitimatelyAbsentFields: [], extractionStrategy: "MRZ_THEN_VISUAL", validationRules: ["MRZ_CHECK_DIGITS"], confidenceThreshold: 0.9,
    sourceEvidenceReferences: ["synthetic"], effectiveFrom: "2026-01-01", effectiveTo: null, lifecycle: "ACTIVE", stagingTestOnly: true, ...overrides };
}

describe("passport profile registry", () => {
  it("matches exact country, type and layout only in an explicitly permitted staging scope", () => {
    const registry = new PassportProfileRegistry([profile()]);
    expect(registry.detect({ issuingCountry: "EGY", passportType: "P", layoutVersion: "synthetic-v1",
      evaluatedAt: "2026-08-27", allowStagingTest: true })).toMatchObject({ state: "PROFILE_MATCHED", reason: "EXACT_COUNTRY_TYPE_LAYOUT_MATCH" });
    expect(registry.detect({ issuingCountry: "EGY", passportType: "P", layoutVersion: "synthetic-v1",
      evaluatedAt: "2026-08-27", allowStagingTest: false })).toMatchObject({ state: "UNKNOWN_PASSPORT_LAYOUT", requiresHumanReview: true });
  });

  it("keeps different family passports independently scoped", () => {
    const registry = new PassportProfileRegistry([profile(), profile({ profileId: "STAGING_TEST_PAKISTAN_TD3", issuingCountry: "PAK" })]);
    const father = registry.detect({ issuingCountry: "EGY", passportType: "P", layoutVersion: "synthetic-v1", evaluatedAt: "2026-08-27", allowStagingTest: true });
    const mother = registry.detect({ issuingCountry: "PAK", passportType: "P", layoutVersion: "synthetic-v1", evaluatedAt: "2026-08-27", allowStagingTest: true });
    expect(father.state === "PROFILE_MATCHED" && father.profile.issuingCountry).toBe("EGY");
    expect(mother.state === "PROFILE_MATCHED" && mother.profile.issuingCountry).toBe("PAK");
  });

  it("fails unknown country/layout to Human Review", () => {
    expect(new PassportProfileRegistry([profile()]).detect({ issuingCountry: "LBN", passportType: "P", layoutVersion: "unknown",
      evaluatedAt: "2026-08-27", allowStagingTest: true })).toEqual({ state: "UNKNOWN_PASSPORT_LAYOUT", profile: null,
      reason: "NO_ACTIVE_PROFILE_MATCH", requiresHumanReview: true });
  });
});

