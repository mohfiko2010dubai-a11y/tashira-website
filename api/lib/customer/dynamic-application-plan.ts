import type { FamilyRelationship } from "../family/family-engine";
import type { DynamicRequirementView } from "../requirements/dynamic-requirements";
import type { SubmissionScheduleSnapshot } from "../travel/submission-scheduler";
import type { TravelQuestion } from "../travel/travel-questionnaire";

export type CustomerApplicantIdentity = {
  applicantId: number;
  displayLabel: string;
  relationship: FamilyRelationship;
};

export type CustomerTravelGroup = {
  travelGroupId: string;
  label: string;
  applicantIds: readonly number[];
  plannedArrivalDate: string | null;
  plannedDepartureDate: string | null;
};

export type DynamicCustomerApplicationPlan = {
  applicationId: number;
  mode: "INDIVIDUAL" | "FAMILY";
  applicants: readonly {
    applicantId: number;
    displayLabel: string;
    relationship: FamilyRelationship;
    evaluationId: string;
    eligibilityState: DynamicRequirementView["familyEligibilityState"];
    questions: DynamicRequirementView["applicants"][number]["questions"];
    uploads: DynamicRequirementView["applicants"][number]["documents"];
    warnings: readonly string[];
    manualReviewRequired: boolean;
  }[];
  caseQuestions: readonly TravelQuestion[];
  travelGroups: readonly CustomerTravelGroup[];
  schedules: readonly {
    travelGroupId: string;
    plannedTravelDate: string;
    submissionState: SubmissionScheduleSnapshot["state"];
    recommendedWindow: { opens: string | null; target: string | null; closes: string | null };
    customerExplanation: string;
  }[];
  canContinueToReview: boolean;
  canContinueToPayment: boolean;
  blockingReasons: readonly string[];
};

const CUSTOMER_SCHEDULE_MESSAGES: Readonly<Record<SubmissionScheduleSnapshot["state"], string>> = {
  NOT_EVALUATED: "Submission timing has not yet been evaluated.",
  NOT_APPLICABLE: "Submission scheduling does not apply to this visa route.",
  TOO_EARLY: "Your application can be completed now, but government submission must wait for the safe submission window.",
    SCHEDULED_FOR_SUBMISSION: "Your completed application will be held safely until the recommended submission window.",
    RECOMMENDED_WINDOW: "Your travel date is within TASHIRA's recommended operational submission window.",
  SUBMISSION_WINDOW_OPEN: "The recommended submission window is open.",
    READY_FOR_SUBMISSION: "Your application is within its recommended submission window.",
    URGENT: "Your travel date is close and requires priority operational review.",
  BLOCKED_BY_REQUIREMENTS: "Complete the listed requirements before submission can proceed.",
  BLOCKED_BY_MANUAL_REVIEW: "A TASHIRA specialist must review this application before submission.",
  OVERDUE: "The recommended submission window needs urgent staff review.",
  ALREADY_SUBMITTED: "This application has already been submitted for government processing.",
  HUMAN_REVIEW_REQUIRED: "Submission timing requires review by a TASHIRA specialist.",
};

function assertApplicantIsolation(input: {
  identities: readonly CustomerApplicantIdentity[];
  requirements: DynamicRequirementView;
  travelGroups: readonly CustomerTravelGroup[];
}): void {
  const identityIds = input.identities.map(({ applicantId }) => applicantId);
  if (identityIds.length === 0 || new Set(identityIds).size !== identityIds.length) {
    throw new Error("CUSTOMER_APPLICANTS_INVALID");
  }
  const allowed = new Set(identityIds);
  const requirementIds = input.requirements.applicants.map(({ applicantId }) => applicantId);
  if (requirementIds.some((id) => !allowed.has(id)) || new Set(requirementIds).size !== requirementIds.length) {
    throw new Error("CUSTOMER_REQUIREMENT_OWNERSHIP_INVALID");
  }
  for (const group of input.travelGroups) {
    if (!group.travelGroupId.trim() || group.applicantIds.length === 0 || group.applicantIds.some((id) => !allowed.has(id))) {
      throw new Error("CUSTOMER_TRAVEL_GROUP_OWNERSHIP_INVALID");
    }
  }
}

export function buildDynamicCustomerApplicationPlan(input: {
  applicationId: number;
  identities: readonly CustomerApplicantIdentity[];
  requirements: DynamicRequirementView;
  travelQuestions: readonly TravelQuestion[];
  travelGroups: readonly CustomerTravelGroup[];
  schedules: readonly SubmissionScheduleSnapshot[];
}): DynamicCustomerApplicationPlan {
  assertApplicantIsolation(input);
  const identities = new Map(input.identities.map((identity) => [identity.applicantId, identity]));
  const blockingReasons: string[] = [];
  const applicants = input.requirements.applicants.map((requirements) => {
    const identity = identities.get(requirements.applicantId);
    if (!identity) throw new Error("CUSTOMER_APPLICANT_IDENTITY_MISSING");
    if (requirements.manualReviewRequired) blockingReasons.push(`APPLICANT_REVIEW_REQUIRED:${requirements.applicantId}`);
    if (requirements.documents.some((document) => document.label === null)) {
      blockingReasons.push(`APPLICANT_REQUIREMENT_UNRESOLVED:${requirements.applicantId}`);
    }
    return {
      ...identity,
      evaluationId: requirements.evaluationId,
      eligibilityState: input.requirements.familyEligibilityState,
      questions: requirements.questions,
      uploads: requirements.documents,
      warnings: requirements.warnings,
      manualReviewRequired: requirements.manualReviewRequired,
    };
  });
  if (input.requirements.familyEligibilityState !== "ELIGIBLE") {
    blockingReasons.push(`FAMILY_ELIGIBILITY:${input.requirements.familyEligibilityState}`);
  }
  const schedules = input.schedules.map((schedule) => ({
    travelGroupId: schedule.travelGroupId,
    plannedTravelDate: schedule.plannedArrivalDate,
    submissionState: schedule.state,
    recommendedWindow: {
      opens: schedule.earliestSafeSubmissionDate,
      target: schedule.targetSubmissionDate,
      closes: schedule.latestSafeSubmissionDate,
    },
    customerExplanation: CUSTOMER_SCHEDULE_MESSAGES[schedule.state],
  }));
  const scheduleBlocksPayment = schedules.some(({ submissionState }) =>
    ["BLOCKED_BY_REQUIREMENTS", "BLOCKED_BY_MANUAL_REVIEW", "HUMAN_REVIEW_REQUIRED"].includes(submissionState));
  const uniqueBlockingReasons = [...new Set(blockingReasons)].sort();
  return {
    applicationId: input.applicationId,
    mode: applicants.length === 1 ? "INDIVIDUAL" : "FAMILY",
    applicants,
    caseQuestions: input.travelQuestions.filter(({ applicantId }) => applicantId === null),
    travelGroups: input.travelGroups.map((group) => ({ ...group, applicantIds: [...group.applicantIds] })),
    schedules,
    canContinueToReview: uniqueBlockingReasons.length === 0,
    canContinueToPayment: uniqueBlockingReasons.length === 0 && !scheduleBlocksPayment,
    blockingReasons: uniqueBlockingReasons,
  };
}
