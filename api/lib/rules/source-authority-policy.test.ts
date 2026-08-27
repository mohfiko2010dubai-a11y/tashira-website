import { describe, expect, it } from "vitest";
import { assertSourceClassification, OFFICIAL_SOURCE_POLICY_VERSION } from "./source-authority-policy";

describe("official source authority policy", () => {
  it.each(["ICP", "GDRFA", "UAE_GOVERNMENT_PORTAL", "OTHER_UAE_GOVERNMENT_AUTHORITY"] as const)(
    "accepts governed official authority type %s",
    (authorityType) => expect(() => assertSourceClassification({
      classification: "OFFICIAL", authorityType, policyVersion: OFFICIAL_SOURCE_POLICY_VERSION,
      url: "https://official.example.invalid/evidence",
    })).not.toThrow(),
  );

  it.each(["COMMERCIAL", "BLOG", "FORUM", "SOCIAL_MEDIA"] as const)(
    "rejects %s as OFFICIAL",
    (authorityType) => expect(() => assertSourceClassification({
      classification: "OFFICIAL", authorityType, policyVersion: OFFICIAL_SOURCE_POLICY_VERSION,
      url: "https://example.invalid/article",
    })).toThrow("NON_OFFICIAL_SOURCE_CANNOT_BE_CLASSIFIED_OFFICIAL"),
  );

  it("rejects unknown policy versions and credential-bearing URLs", () => {
    expect(() => assertSourceClassification({ classification: "OFFICIAL", authorityType: "ICP", policyVersion: "V2", url: "https://official.example.invalid" }))
      .toThrow("SOURCE_AUTHORITY_POLICY_VERSION_UNSUPPORTED");
    expect(() => assertSourceClassification({ classification: "OFFICIAL", authorityType: "ICP", policyVersion: OFFICIAL_SOURCE_POLICY_VERSION, url: "https://user:pass@official.example.invalid" }))
      .toThrow("SOURCE_AUTHORITY_URL_INVALID");
  });
});
