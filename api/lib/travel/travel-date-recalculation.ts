import { createHash } from "node:crypto";
import type { OperationalSubmissionPolicy } from "./operational-submission-policy";
import { evaluateSubmissionSchedule, type SubmissionScheduleSnapshot, type SubmissionTimingRule } from "./submission-scheduler";
import { schedulerCommunicationEvents } from "./scheduler-runtime";

export type TravelDateChangeEvidence = {
  eventId: string;
  travelGroupId: string;
  previousScheduleEvaluationId: string;
  newScheduleEvaluationId: string;
  previousArrivalDate: string;
  newArrivalDate: string;
  previousTravelGroupVersion: number;
  newTravelGroupVersion: number;
  actorReference: string;
  reason: string;
  occurredAt: string;
  communicationEvents: readonly string[];
  evidenceSha256: string;
};

export function recalculateForTravelDateChange(input: {
  eventId: string; newEvaluationId: string; previous: SubmissionScheduleSnapshot;
  expectedTravelGroupVersion: number; currentTravelGroupVersion: number; newArrivalDate: string;
  actorReference: string; reason: string; occurredAt: Date; alreadySubmitted: boolean;
  officialRule: SubmissionTimingRule | null; operationalPolicy: OperationalSubmissionPolicy | null;
  readinessSatisfied: boolean; manualReviewRequired?: boolean; blockingReasons?: readonly string[];
  sourceEvidenceReferences?: readonly string[];
}): { schedule: SubmissionScheduleSnapshot; evidence: TravelDateChangeEvidence } {
  if (input.expectedTravelGroupVersion !== input.currentTravelGroupVersion) throw new Error("TRAVEL_GROUP_VERSION_CONFLICT");
  if (!input.actorReference.trim() || !input.reason.trim()) throw new Error("TRAVEL_DATE_CHANGE_EVIDENCE_REQUIRED");
  if (input.previous.plannedArrivalDate === input.newArrivalDate) throw new Error("TRAVEL_DATE_UNCHANGED");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.newArrivalDate)) throw new Error("INVALID_TRAVEL_DATE");
  const schedule = evaluateSubmissionSchedule({ evaluationId: input.newEvaluationId, evaluatedAt: input.occurredAt,
    travelGroupId: input.previous.travelGroupId, routeCode: input.previous.routeCode, plannedArrivalDate: input.newArrivalDate,
    officialRule: input.officialRule, operationalPolicy: input.operationalPolicy, readinessSatisfied: input.readinessSatisfied,
    manualReviewRequired: input.manualReviewRequired, blockingReasons: input.blockingReasons,
    travelDateChangedAfterSubmission: input.alreadySubmitted, recalculationReason: input.alreadySubmitted
      ? "TRAVEL_DATE_CHANGED_AFTER_SUBMISSION" : "TRAVEL_DATE_CHANGED_BEFORE_SUBMISSION",
    sourceEvidenceReferences: input.sourceEvidenceReferences });
  const communicationEvents = schedulerCommunicationEvents({ previous: input.previous, current: schedule });
  const evidenceBase = { eventId: input.eventId, travelGroupId: input.previous.travelGroupId,
    previousScheduleEvaluationId: input.previous.evaluationId, newScheduleEvaluationId: schedule.evaluationId,
    previousArrivalDate: input.previous.plannedArrivalDate, newArrivalDate: input.newArrivalDate,
    previousTravelGroupVersion: input.currentTravelGroupVersion, newTravelGroupVersion: input.currentTravelGroupVersion + 1,
    actorReference: input.actorReference.trim(), reason: input.reason.trim(), occurredAt: input.occurredAt.toISOString(), communicationEvents };
  return { schedule, evidence: { ...evidenceBase,
    evidenceSha256: createHash("sha256").update(JSON.stringify(evidenceBase)).digest("hex") } };
}
