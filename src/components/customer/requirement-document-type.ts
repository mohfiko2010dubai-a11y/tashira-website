export type LegacyDocumentType = "passport" | "photo" | "national_id" | "supporting" | "gcc_residence" | "sponsor_id";

export function legacyDocumentType(requirementCode: string): LegacyDocumentType {
  if (requirementCode === "PASSPORT") return "passport";
  if (requirementCode === "PERSONAL_PHOTO" || requirementCode === "PHOTO") return "photo";
  if (requirementCode === "NATIONAL_ID") return "national_id";
  if (requirementCode === "GCC_RESIDENCE" || requirementCode === "GCC_RESIDENCE_CARD") return "gcc_residence";
  if (requirementCode === "SPONSOR_ID") return "sponsor_id";
  return "supporting";
}
