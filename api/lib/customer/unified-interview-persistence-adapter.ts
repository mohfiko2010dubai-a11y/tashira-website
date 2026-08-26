import { aggregateFamilyEvaluations, type FamilyMember, type FamilyRelationship } from "../family/family-engine";
import type { MysqlOperationsCaseBundle } from "../operations/mysql-case-read-provider";
import type { SharedTravelDocument, TicketDocumentType, TravelGroup } from "../travel/travel-party";
import type { SubmissionScheduleSnapshot } from "../travel/submission-scheduler";
import type { CustomerApplicantIdentity } from "./dynamic-application-plan";

const documentTypes = new Set<TicketDocumentType>([
  "OUTBOUND_TICKET", "RETURN_TICKET", "ONWARD_TICKET", "ROUND_TRIP_TICKET", "FAMILY_BOOKING",
]);

function identities(bundle: MysqlOperationsCaseBundle): readonly CustomerApplicantIdentity[] {
  const ordered = [...bundle.source.applicants].sort((left, right) => left.applicantIndex - right.applicantIndex);
  const lead = ordered[0];
  if (!lead) throw new Error("UNIFIED_INTERVIEW_HAS_NO_APPLICANTS");
  const relationships = bundle.family.currentRelationships(bundle.source.summary.applicationId);
  return ordered.map((applicant): CustomerApplicantIdentity => {
    if (applicant.applicantId === lead.applicantId) {
      return { applicantId: applicant.applicantId, displayLabel: applicant.displayName, relationship: "LEAD_APPLICANT" };
    }
    const relationship = relationships.find((event) => event.fromApplicantId === lead.applicantId
      && event.toApplicantId === applicant.applicantId)?.relationship;
    if (!relationship) throw new Error(`UNIFIED_INTERVIEW_RELATIONSHIP_MISSING:${applicant.applicantId}`);
    return { applicantId: applicant.applicantId, displayLabel: applicant.displayName, relationship };
  });
}

export function adaptPersistentUnifiedInterview(bundle: MysqlOperationsCaseBundle): {
  identities: readonly CustomerApplicantIdentity[];
  family: ReturnType<typeof aggregateFamilyEvaluations>;
  travelGroups: readonly TravelGroup[];
  schedules: readonly SubmissionScheduleSnapshot[];
  sharedDocuments: readonly SharedTravelDocument[];
} {
  const applicantIdentities = identities(bundle);
  const members: FamilyMember[] = applicantIdentities.map(({ applicantId, relationship }) => ({ applicantId, relationship: relationship as FamilyRelationship }));
  const applicationId = bundle.source.summary.applicationId;
  const family = aggregateFamilyEvaluations({ applicationId, members, snapshots: bundle.snapshots });
  const sourceGroups = bundle.source.travelGroups ?? [];
  const travelGroups: TravelGroup[] = sourceGroups.map((group) => ({
    id: group.id, applicationId, applicantIds: [...group.applicantIds], primaryTravellerId: group.primaryTravellerId,
    accompanyingAdultId: group.accompanyingAdultId, arrangement: group.arrangement, origin: group.origin, destination: group.destination,
    plannedArrivalDate: group.plannedArrivalDate, plannedDepartureDate: group.plannedDepartureDate, ticketStatus: group.ticketStatus,
  }));
  const schedules = sourceGroups.flatMap((group) => group.currentSchedule ? [group.currentSchedule as SubmissionScheduleSnapshot] : []);
  const documents = new Map<number, { type: TicketDocumentType; applicantIds: Set<number> }>();
  for (const group of sourceGroups) for (const document of group.sharedDocuments) {
    if (!documentTypes.has(document.documentType as TicketDocumentType)) throw new Error("UNIFIED_INTERVIEW_DOCUMENT_TYPE_INVALID");
    const current = documents.get(document.documentId) ?? { type: document.documentType as TicketDocumentType, applicantIds: new Set<number>() };
    if (current.type !== document.documentType) throw new Error("UNIFIED_INTERVIEW_DOCUMENT_TYPE_CONFLICT");
    for (const applicantId of document.applicantIds) current.applicantIds.add(applicantId);
    documents.set(document.documentId, current);
  }
  const sharedDocuments: SharedTravelDocument[] = [...documents.entries()].map(([documentId, document]) => ({
    id: String(documentId), applicationId, type: document.type, linkedApplicantIds: [...document.applicantIds].sort((left, right) => left - right),
  }));
  return { identities: applicantIdentities, family, travelGroups, schedules, sharedDocuments };
}
