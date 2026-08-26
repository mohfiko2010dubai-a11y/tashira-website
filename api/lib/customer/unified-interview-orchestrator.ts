import type { FeatureFlagContext, FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { FamilyEvaluation } from "../family/family-engine";
import type { MysqlRequirementCatalogProvider } from "../requirements/mysql-requirement-catalog-provider";
import type { ApplicantAnswers } from "../requirements/dynamic-requirements";
import type { SubmissionScheduleSnapshot } from "../travel/submission-scheduler";
import type { SharedTravelDocument, TravelGroup } from "../travel/travel-party";
import { validateSharedTravelDocument, validateTravelGroup } from "../travel/travel-party";
import type { TravelQuestion } from "../travel/travel-questionnaire";
import { buildDynamicApplicationFromCatalog } from "./dynamic-application-runtime";
import type { CustomerApplicantIdentity, CustomerTravelGroup } from "./dynamic-application-plan";

export type UnifiedInterviewReview = {
  applicationId: number;
  applicants: readonly { applicantId: number; label: string; relationship: string; eligibilityState: string;
    requirements: readonly { code: string; label: string | null; state: "REQUIRED" | "CONDITIONAL"; classification: string; reason: string }[];
    warnings: readonly string[] }[];
  relationships: readonly { applicantId: number; relationship: string }[];
  travelGroups: readonly CustomerTravelGroup[];
  sharedDocuments: readonly { documentId: string; type: SharedTravelDocument["type"]; linkedApplicantIds: readonly number[];
    missingApplicantIds: readonly number[] }[];
  schedules: readonly { travelGroupId: string; state: SubmissionScheduleSnapshot["state"]; plannedArrivalDate: string;
    targetSubmissionDate: string | null; explanation: string }[];
  blockingReasons: readonly string[];
  manualReviewRequired: boolean;
};

function validateTravelOwnership(input: { applicationId: number; applicantIds: ReadonlySet<number>; groups: readonly TravelGroup[];
  documents: readonly SharedTravelDocument[]; schedules: readonly SubmissionScheduleSnapshot[] }): void {
  const groupIds = new Set(input.groups.map(({ id }) => id));
  if (groupIds.size !== input.groups.length) throw new Error("UNIFIED_INTERVIEW_TRAVEL_GROUP_DUPLICATE");
  for (const group of input.groups) {
    if (group.applicationId !== input.applicationId || group.applicantIds.some((id) => !input.applicantIds.has(id))) {
      throw new Error("UNIFIED_INTERVIEW_TRAVEL_OWNERSHIP_INVALID");
    }
    const validation = validateTravelGroup(group);
    if (!validation.valid) throw new Error(`UNIFIED_INTERVIEW_TRAVEL_INVALID:${validation.errors.join(",")}`);
  }
  for (const document of input.documents) {
    if (document.applicationId !== input.applicationId) throw new Error("UNIFIED_INTERVIEW_DOCUMENT_OWNERSHIP_INVALID");
    const validation = validateSharedTravelDocument({ document, groups: input.groups });
    if (!validation.valid) throw new Error(`UNIFIED_INTERVIEW_DOCUMENT_INVALID:${validation.errors.join(",")}`);
  }
  const scheduleGroupIds = input.schedules.map(({ travelGroupId }) => travelGroupId);
  if (new Set(scheduleGroupIds).size !== scheduleGroupIds.length) throw new Error("UNIFIED_INTERVIEW_SCHEDULE_DUPLICATE");
  if (scheduleGroupIds.some((travelGroupId) => !groupIds.has(travelGroupId))) {
    throw new Error("UNIFIED_INTERVIEW_SCHEDULE_OWNERSHIP_INVALID");
  }
}

export async function buildUnifiedInterviewRuntime(input: {
  context: FeatureFlagContext;
  flags: readonly FeatureFlagRecord[];
  catalogProvider: Pick<MysqlRequirementCatalogProvider, "active">;
  evaluatedAt: Date;
  applicationId: number;
  identities: readonly CustomerApplicantIdentity[];
  family: FamilyEvaluation;
  answers: ApplicantAnswers;
  travelQuestions: readonly TravelQuestion[];
  travelGroups: readonly TravelGroup[];
  schedules: readonly SubmissionScheduleSnapshot[];
  sharedDocuments: readonly SharedTravelDocument[];
}): Promise<{ review: UnifiedInterviewReview | null; portalHandoff: UnifiedInterviewReview | null }> {
  const applicantIds = new Set(input.identities.map(({ applicantId }) => applicantId));
  if (applicantIds.size !== input.identities.length || input.family.applicationId !== input.applicationId
    || input.family.members.some(({ applicantId }) => !applicantIds.has(applicantId))) throw new Error("UNIFIED_INTERVIEW_APPLICANT_OWNERSHIP_INVALID");
  validateTravelOwnership({ applicationId: input.applicationId, applicantIds, groups: input.travelGroups,
    documents: input.sharedDocuments, schedules: input.schedules });
  const customerGroups: CustomerTravelGroup[] = input.travelGroups.map((group, index) => ({ travelGroupId: group.id,
    label: `Trip ${String.fromCharCode(65 + index)}`, applicantIds: [...group.applicantIds], plannedArrivalDate: group.plannedArrivalDate,
    plannedDepartureDate: group.plannedDepartureDate }));
  const dynamic = await buildDynamicApplicationFromCatalog({ ...input, travelGroups: customerGroups });
  if (!dynamic.plan || !dynamic.requirements) return { review: null, portalHandoff: null };
  const identities = new Map(input.identities.map((identity) => [identity.applicantId, identity]));
  const review: UnifiedInterviewReview = {
    applicationId: input.applicationId,
    applicants: dynamic.requirements.applicants.map((applicant) => {
      const identity = identities.get(applicant.applicantId);
      if (!identity) throw new Error("UNIFIED_INTERVIEW_APPLICANT_IDENTITY_MISSING");
      const familyMember = input.family.members.find((member) => member.applicantId === applicant.applicantId);
      if (!familyMember) throw new Error("UNIFIED_INTERVIEW_FAMILY_MEMBER_MISSING");
      return { applicantId: applicant.applicantId, label: identity.displayLabel, relationship: identity.relationship,
        eligibilityState: familyMember.eligibilityState, requirements: applicant.documents.map((document) => ({ code: document.code,
          label: document.label, state: document.state, classification: document.classification, reason: document.reason })), warnings: [...applicant.warnings] };
    }),
    relationships: input.identities.map(({ applicantId, relationship }) => ({ applicantId, relationship })),
    travelGroups: customerGroups,
    sharedDocuments: input.sharedDocuments.map((document) => {
      const covered = new Set(document.linkedApplicantIds);
      const groupApplicants = new Set(input.travelGroups.filter((group) => group.applicantIds.some((id) => covered.has(id))).flatMap((group) => group.applicantIds));
      return { documentId: document.id, type: document.type, linkedApplicantIds: [...document.linkedApplicantIds],
        missingApplicantIds: [...groupApplicants].filter((id) => !covered.has(id)).sort((a, b) => a - b) };
    }),
    schedules: dynamic.plan.schedules.map((schedule) => ({ travelGroupId: schedule.travelGroupId, state: schedule.submissionState,
      plannedArrivalDate: schedule.plannedTravelDate, targetSubmissionDate: schedule.recommendedWindow.target, explanation: schedule.customerExplanation })),
    blockingReasons: [...dynamic.plan.blockingReasons], manualReviewRequired: dynamic.plan.applicants.some(({ manualReviewRequired }) => manualReviewRequired),
  };
  return { review, portalHandoff: structuredClone(review) };
}
