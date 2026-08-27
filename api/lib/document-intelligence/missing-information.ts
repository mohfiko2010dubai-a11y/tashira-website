import type { ApplicantFieldResolution, AuthorityFieldRequirement } from "./contracts";

export type MissingInformationAction = {
  applicantId: number;
  fieldCode: string;
  state:
    | "AVAILABLE_VERIFIED"
    | "AVAILABLE_CONFIRMED"
    | "AVAILABLE_EXTRACTED_NEEDS_CONFIRMATION"
    | "MISSING"
    | "CONFLICT"
    | "HUMAN_REVIEW_REQUIRED";
  action: "NONE" | "CUSTOMER_CONFIRMATION" | "DYNAMIC_QUESTION" | "SUPPORTING_DOCUMENT" | "HUMAN_REVIEW";
  reason: string;
};

export function determineMissingInformation(input: {
  applicantId: number;
  requirements: readonly AuthorityFieldRequirement[];
  resolutions: readonly ApplicantFieldResolution[];
}): readonly MissingInformationAction[] {
  if (input.resolutions.some((resolution) => resolution.applicantId !== input.applicantId)) throw new Error("MISSING_INFORMATION_APPLICANT_SCOPE_MISMATCH");
  const byCode = new Map(input.resolutions.map((resolution) => [resolution.fieldCode, resolution]));
  return input.requirements.filter((requirement) => requirement.requirement === "REQUIRED").map((requirement) => {
    const resolution = byCode.get(requirement.fieldCode);
    if (!resolution || resolution.state === "MISSING") return { applicantId: input.applicantId, fieldCode: requirement.fieldCode,
      state: "MISSING", action: requirement.fallbackSources.includes("CUSTOMER_DECLARED") ? "DYNAMIC_QUESTION" : "SUPPORTING_DOCUMENT",
      reason: "MISSING_REQUIRED_AUTHORITY_FIELD" } as const;
    if (resolution.state === "CONFLICTED") return { applicantId: input.applicantId, fieldCode: requirement.fieldCode,
      state: "CONFLICT", action: "HUMAN_REVIEW", reason: "IDENTITY_DATA_CONFLICT" } as const;
    if (resolution.requiresHumanReview) return { applicantId: input.applicantId, fieldCode: requirement.fieldCode,
      state: "HUMAN_REVIEW_REQUIRED", action: "HUMAN_REVIEW", reason: resolution.reason } as const;
    if (resolution.state === "VERIFIED") return { applicantId: input.applicantId, fieldCode: requirement.fieldCode,
      state: "AVAILABLE_VERIFIED", action: "NONE", reason: resolution.reason } as const;
    if (resolution.state === "CONFIRMED") return { applicantId: input.applicantId, fieldCode: requirement.fieldCode,
      state: "AVAILABLE_CONFIRMED", action: "NONE", reason: resolution.reason } as const;
    return { applicantId: input.applicantId, fieldCode: requirement.fieldCode,
      state: "AVAILABLE_EXTRACTED_NEEDS_CONFIRMATION", action: "CUSTOMER_CONFIRMATION", reason: resolution.reason } as const;
  });
}
