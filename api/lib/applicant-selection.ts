import { TRPCError } from "@trpc/server";

export type ApplicantSelection = {
  id: number;
  applicationId: number;
  applicantIndex: number;
};

export function assertApplicantSelection(
  applicant: ApplicantSelection | undefined,
  expected: { applicationId: number; applicantId: number; applicantIndex?: number },
): ApplicantSelection {
  if (
    !applicant
    || applicant.id !== expected.applicantId
    || applicant.applicationId !== expected.applicationId
    || (expected.applicantIndex !== undefined && applicant.applicantIndex !== expected.applicantIndex)
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Applicant does not belong to the selected application slot" });
  }
  return applicant;
}
