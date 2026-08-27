import { z } from "zod";

export const OFFICIAL_SOURCE_POLICY_VERSION = "UAE_OFFICIAL_SOURCE_POLICY_V1" as const;

export const sourceAuthorityTypeSchema = z.enum([
  "ICP",
  "GDRFA",
  "UAE_GOVERNMENT_PORTAL",
  "OTHER_UAE_GOVERNMENT_AUTHORITY",
  "COMMERCIAL",
  "BLOG",
  "FORUM",
  "SOCIAL_MEDIA",
]);

export type SourceAuthorityType = z.infer<typeof sourceAuthorityTypeSchema>;

const officialAuthorityTypes: ReadonlySet<SourceAuthorityType> = new Set([
  "ICP",
  "GDRFA",
  "UAE_GOVERNMENT_PORTAL",
  "OTHER_UAE_GOVERNMENT_AUTHORITY",
]);

export function assertSourceClassification(input: {
  classification: "OFFICIAL" | "OPERATIONAL" | "CONDITIONAL" | "INTERNAL";
  authorityType: SourceAuthorityType;
  policyVersion: string;
  url: string;
}): void {
  if (input.policyVersion !== OFFICIAL_SOURCE_POLICY_VERSION) {
    throw new Error("SOURCE_AUTHORITY_POLICY_VERSION_UNSUPPORTED");
  }
  const url = new URL(input.url);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("SOURCE_AUTHORITY_URL_INVALID");
  }
  if (input.classification === "OFFICIAL" && !officialAuthorityTypes.has(input.authorityType)) {
    throw new Error("NON_OFFICIAL_SOURCE_CANNOT_BE_CLASSIFIED_OFFICIAL");
  }
}
