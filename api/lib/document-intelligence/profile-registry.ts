import { validatePassportProfile, type PassportProfile } from "./contracts";

export type PassportProfileDetection =
  | { state: "PROFILE_MATCHED"; profile: PassportProfile; reason: string }
  | { state: "UNKNOWN_PASSPORT_LAYOUT"; profile: null; reason: string; requiresHumanReview: true };

export class PassportProfileRegistry {
  readonly #profiles: readonly PassportProfile[];
  constructor(profiles: readonly PassportProfile[]) {
    this.#profiles = profiles.map(validatePassportProfile);
    const identities = this.#profiles.map((profile) => `${profile.profileId}:${profile.version}`);
    if (new Set(identities).size !== identities.length) throw new Error("PASSPORT_PROFILE_VERSION_DUPLICATE");
  }

  detect(input: { issuingCountry: string; passportType: string; layoutVersion: string; evaluatedAt: string; allowStagingTest: boolean }): PassportProfileDetection {
    const evaluatedAt = Date.parse(input.evaluatedAt);
    if (Number.isNaN(evaluatedAt)) throw new Error("PASSPORT_PROFILE_EVALUATION_TIMESTAMP_INVALID");
    const matches = this.#profiles.filter((profile) => profile.issuingCountry === input.issuingCountry
      && profile.passportType === input.passportType && profile.layoutVersion === input.layoutVersion
      && profile.lifecycle === "ACTIVE" && (!profile.stagingTestOnly || input.allowStagingTest)
      && Date.parse(profile.effectiveFrom) <= evaluatedAt && (profile.effectiveTo === null || Date.parse(profile.effectiveTo) > evaluatedAt));
    if (matches.length !== 1) return { state: "UNKNOWN_PASSPORT_LAYOUT", profile: null,
      reason: matches.length === 0 ? "NO_ACTIVE_PROFILE_MATCH" : "AMBIGUOUS_ACTIVE_PROFILE_MATCH", requiresHumanReview: true };
    return { state: "PROFILE_MATCHED", profile: structuredClone(matches[0]!), reason: "EXACT_COUNTRY_TYPE_LAYOUT_MATCH" };
  }
}

