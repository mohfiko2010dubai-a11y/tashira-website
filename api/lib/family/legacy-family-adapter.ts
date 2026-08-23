import type { FamilyMember } from "./family-engine";

export type LegacyFamilyAdapterResult = {
  members: readonly FamilyMember[];
  warnings: readonly string[];
};

export function adaptLegacyFamily(applicants: readonly { applicantId: number; applicantIndex: number }[]): LegacyFamilyAdapterResult {
  if (applicants.length === 0) throw new Error("Legacy family must contain at least one applicant");
  const ids = applicants.map((applicant) => applicant.applicantId);
  const indexes = applicants.map((applicant) => applicant.applicantIndex);
  if (new Set(ids).size !== ids.length || new Set(indexes).size !== indexes.length) {
    throw new Error("Legacy family applicant IDs and indexes must be unique");
  }
  const ordered = [...applicants].sort((left, right) => left.applicantIndex - right.applicantIndex);
  return {
    members: ordered.map((applicant, index) => ({
      applicantId: applicant.applicantId,
      relationship: index === 0 ? "LEAD_APPLICANT" : "OTHER",
    })),
    warnings: ["LEGACY_RELATIONSHIP_GRAPH_INFERRED", "SPECIFIC_RELATIONSHIPS_REQUIRE_REVIEW"],
  };
}
