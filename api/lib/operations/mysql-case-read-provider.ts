import type { SupplierOperationalView } from "../authorization/policy";
import type { EvaluationEvidenceSnapshot } from "../eligibility/evaluation-evidence";
import { ELIGIBILITY_ENGINE_VERSION } from "../eligibility/evaluation-evidence";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";
import { InMemoryFamilyPersistenceRepository } from "../family/family-persistence";
import type { OperationsSqlClient } from "./mysql-access-provider";
import type { OperationsCaseSource, OperationsTravelGroup } from "./case-read-model";
import type { SubmissionScheduleState } from "../travel/submission-scheduler";
import type { SchedulerAlertEvent, SchedulerAlertSeverity, SchedulerAlertState, SchedulerAlertType, SchedulerQueueCategory } from "../travel/scheduler-runtime";

type Row = Record<string, unknown>;

function value(row: object, key: string): unknown { return Reflect.get(row, key); }
function text(row: object, key: string, fallback = ""): string {
  const candidate = value(row, key);
  return typeof candidate === "string" ? candidate : candidate instanceof Date ? candidate.toISOString() : fallback;
}
function nullableText(row: object, key: string): string | null {
  const candidate = value(row, key);
  return typeof candidate === "string" ? candidate : null;
}
function number(row: object, key: string): number {
  const candidate = value(row, key);
  const parsed = typeof candidate === "number" ? candidate : Number(candidate);
  if (!Number.isSafeInteger(parsed)) throw new Error(`INVALID_OPERATIONS_ROW:${key}`);
  return parsed;
}
function nullableNumber(row: object, key: string): number | undefined {
  const candidate = value(row, key);
  if (candidate === null || candidate === undefined) return undefined;
  const parsed = typeof candidate === "number" ? candidate : Number(candidate);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
function json<T>(row: object, key: string, fallback: T): T {
  const candidate = value(row, key);
  if (candidate === null || candidate === undefined) return fallback;
  if (typeof candidate === "string") return JSON.parse(candidate) as T;
  return candidate as T;
}

const eligibilityStates = new Set(["ELIGIBLE", "INELIGIBLE", "HUMAN_REVIEW_REQUIRED", "RULE_CONFLICT"]);
const relationshipTypes = new Set(["SPOUSE", "CHILD", "PARENT", "GUARDIAN", "DEPENDENT", "SIBLING", "OTHER"]);
const requirementKinds = new Set(["DOCUMENT", "QUESTION"]);
const requirementStates = new Set(["MISSING", "UPLOADED", "VALIDATED", "WAIVED", "CONDITIONAL_PENDING"]);

export type MysqlOperationsCaseBundle = {
  source: OperationsCaseSource;
  snapshots: InMemoryEligibilitySnapshotRepository;
  family: InMemoryFamilyPersistenceRepository;
};

/** Read-only, finance-minimized projection. No pricing, payment, Stripe or cost columns are selected. */
export class MysqlOperationsCaseReadProvider {
  private readonly sql: OperationsSqlClient;

  constructor(sql: OperationsSqlClient) {
    this.sql = sql;
  }

  async load(reference: string): Promise<MysqlOperationsCaseBundle | null> {
    const applications = await this.sql.query(
      `SELECT a.id, a.reference_number AS reference, a.status, a.created_at AS createdAt,
              a.supplier_id AS supplierId, c.assigned_staff_user_id AS assignedStaffId,
              c.team_id AS teamId, t.department_id AS departmentId
         FROM applications a
         LEFT JOIN operations_case_controls c ON c.application_id=a.id
         LEFT JOIN operations_teams t ON t.id=c.team_id
        WHERE a.reference_number=? LIMIT 1`, [reference],
    );
    const application = applications[0];
    if (!application) return null;
    const applicationId = number(application, "id");

    const [applicantRows, documentRows, evaluationRows, matchRows, selectionRows, relationshipRows,
      requirementRows, requirementEventRows, timelineRows, supplierRows, travelGroupRows, travelMemberRows,
      travelDocumentRows, scheduleRows, schedulerAlertRows] = await Promise.all([
      this.sql.query(`SELECT id, applicant_index AS applicantIndex, full_name AS displayName,
                            nationality, gcc_residence_country AS residenceCountry
                       FROM applicants WHERE application_id=? ORDER BY applicant_index,id`, [applicationId]),
      this.sql.query(`SELECT id, applicant_id AS applicantId, document_type AS code, upload_status AS uploadStatus
                       FROM documents WHERE application_id=? AND applicant_id IS NOT NULL ORDER BY applicant_id,id`, [applicationId]),
      this.sql.query(`SELECT id, applicant_id AS applicantId, route_code AS selectedRoute,
                            engine_version AS engineVersion, final_eligibility_state AS eligibilityState,
                            decision_reason AS reason, manual_review_reason AS manualReviewReason,
                            reevaluation_reason AS reevaluationReason, required_documents_json AS requiredDocuments,
                            conditional_documents_json AS conditionalDocuments, warnings_json AS warnings,
                            precedence_trace_json AS precedenceTrace, supersedes_evaluation_id AS supersedesEvaluationId,
                            evidence_sha256 AS evidenceSha256, evaluated_at AS evaluatedAt
                       FROM visa_rule_evaluation_runs WHERE application_id=? ORDER BY evaluated_at,id`, [applicationId]),
      this.sql.query(`SELECT m.evaluation_id AS evaluationId, m.sequence_number AS sequenceNumber,
                            m.stable_rule_id AS ruleId, m.rule_version_number AS ruleVersion,
                            m.rule_layer AS layer, m.classification, m.source_authority AS sourceAuthority,
                            m.match_reason AS reason
                       FROM visa_rule_evaluation_matches m
                       JOIN visa_rule_evaluation_runs r ON r.id=m.evaluation_id
                      WHERE r.application_id=? ORDER BY m.evaluation_id,m.sequence_number`, [applicationId]),
      this.sql.query(`SELECT id, applicant_id AS applicantId, evaluation_id AS evaluationId,
                            selection_reason AS reason, selected_by AS selectedBy, selected_at AS selectedAt
                       FROM visa_rule_evaluation_selections WHERE application_id=? ORDER BY selected_at,id`, [applicationId]),
      this.sql.query(`SELECT id, from_applicant_id AS fromApplicantId, to_applicant_id AS toApplicantId,
                            relationship_type AS relationship, event_type AS eventType, reason, occurred_at AS occurredAt
                       FROM family_relationship_events WHERE application_id=? ORDER BY occurred_at,id`, [applicationId]),
      this.sql.query(`SELECT id, applicant_id AS applicantId, evaluation_id AS evaluationId,
                            catalog_version AS catalogVersion, requirement_code AS code,
                            requirement_kind AS kind, critical, conditional, created_at AS createdAt
                       FROM applicant_requirement_instances WHERE application_id=? ORDER BY applicant_id,created_at,id`, [applicationId]),
      this.sql.query(`SELECT e.id, e.requirement_instance_id AS instanceId, e.state, e.reason, e.occurred_at AS occurredAt
                       FROM applicant_requirement_events e
                       JOIN applicant_requirement_instances i ON i.id=e.requirement_instance_id
                      WHERE i.application_id=? ORDER BY e.occurred_at,e.id`, [applicationId]),
      this.sql.query(`SELECT id, event_name AS event, actor_type AS actorType, created_at AS occurredAt
                       FROM application_timeline_events WHERE application_id=? ORDER BY created_at,id`, [applicationId]),
      nullableNumber(application, "supplierId") === undefined ? Promise.resolve([]) : this.sql.query(
        `SELECT id, name FROM suppliers WHERE id=? AND is_active='active' LIMIT 1`, [nullableNumber(application, "supplierId") ?? 0]),
      this.sql.query(`SELECT id, travel_group_reference AS reference, arrangement,
                            primary_traveller_id AS primaryTravellerId, accompanying_adult_id AS accompanyingAdultId,
                            origin, destination, planned_arrival_date AS plannedArrivalDate,
                            planned_departure_date AS plannedDepartureDate, ticket_status AS ticketStatus
                       FROM travel_groups WHERE application_id=? ORDER BY planned_arrival_date,id`, [applicationId]),
      this.sql.query(`SELECT travel_group_id AS travelGroupId, applicant_id AS applicantId
                       FROM travel_group_applicants WHERE application_id=? ORDER BY travel_group_id,applicant_id`, [applicationId]),
      this.sql.query(`SELECT document_id AS documentId, applicant_id AS applicantId, document_type AS documentType
                       FROM travel_document_applicant_links WHERE application_id=? ORDER BY document_id,applicant_id`, [applicationId]),
      this.sql.query(`SELECT id, travel_group_id AS travelGroupId, route_code AS routeCode,
                            planned_arrival_date AS plannedArrivalDate,
                            earliest_safe_submission_date AS earliestSafeSubmissionDate,
                            target_submission_date AS targetSubmissionDate,
                            latest_safe_submission_date AS latestSafeSubmissionDate,
                            schedule_state AS state, reason, blocking_reasons_json AS blockingReasons,
                            recalculation_reason AS recalculationReason, rule_versions_json AS ruleVersions,
                            source_evidence_references_json AS sourceEvidenceReferences,
                            evaluator_version AS evaluatorVersion, evidence_sha256 AS evidenceSha256,
                            evaluated_at AS evaluatedAt
                       FROM submission_schedule_snapshots WHERE application_id=? ORDER BY evaluated_at,id`, [applicationId]),
      this.sql.query(`SELECT e.id,e.alert_key AS alertKey,e.application_id AS applicationId,e.applicant_id AS applicantId,
                            e.travel_group_id AS travelGroupId,e.schedule_evaluation_id AS scheduleEvaluationId,
                            e.alert_type AS alertType,e.severity,e.category,e.alert_state AS alertState,e.version,
                            e.actor_reference AS actorReference,e.reason,e.context_json AS contextJson,
                            e.correlation_id AS correlationId,e.idempotency_key AS idempotencyKey,e.occurred_at AS occurredAt
                       FROM submission_scheduler_alert_events e
                       JOIN (SELECT alert_key,MAX(version) AS version FROM submission_scheduler_alert_events
                              WHERE application_id=? GROUP BY alert_key) current
                         ON current.alert_key=e.alert_key AND current.version=e.version
                      WHERE e.application_id=? ORDER BY e.occurred_at DESC,e.id DESC`, [applicationId, applicationId]),
    ]);

    const applicants = applicantRows.map((row) => ({
      applicantId: number(row, "id"), applicantIndex: number(row, "applicantIndex"),
      displayName: text(row, "displayName", "Applicant"), nationality: nullableText(row, "nationality"),
      residenceCountry: nullableText(row, "residenceCountry"), routeCompatible: true,
    }));
    const applicantIds = new Set(applicants.map((item) => item.applicantId));
    const documents = documentRows.map((row) => {
      const applicantId = number(row, "applicantId");
      if (!applicantIds.has(applicantId)) throw new Error("DOCUMENT_APPLICANT_OWNERSHIP_MISMATCH");
      const uploadStatus = text(row, "uploadStatus");
      return {
        documentId: number(row, "id"), applicantId, code: text(row, "code"),
        readiness: uploadStatus === "uploaded" ? "UPLOADED" as const : uploadStatus === "replaced" ? "REJECTED" as const : "MISSING" as const,
      };
    });

    const matches = new Map<string, Row[]>();
    for (const row of matchRows) {
      const evaluationId = text(row, "evaluationId");
      matches.set(evaluationId, [...(matches.get(evaluationId) ?? []), row as Row]);
    }
    const snapshots = new InMemoryEligibilitySnapshotRepository();
    for (const row of evaluationRows) {
      const evaluationId = text(row, "id");
      const applicantId = number(row, "applicantId");
      if (!applicantIds.has(applicantId)) throw new Error("EVALUATION_APPLICANT_OWNERSHIP_MISMATCH");
      const eligibilityState = text(row, "eligibilityState");
      if (!eligibilityStates.has(eligibilityState)) throw new Error("INVALID_ELIGIBILITY_STATE");
      const matchedRules = (matches.get(evaluationId) ?? []).map((match) => ({
        ruleId: text(match, "ruleId"), ruleVersion: number(match, "ruleVersion"),
        layer: text(match, "layer") as EvaluationEvidenceSnapshot["matchedRules"][number]["layer"],
        classification: text(match, "classification") as EvaluationEvidenceSnapshot["matchedRules"][number]["classification"],
        sourceAuthority: text(match, "sourceAuthority"), reason: text(match, "reason"),
      }));
      const evidenceSha256 = text(row, "evidenceSha256");
      snapshots.append({
        evaluationId, applicationId, applicantId, engineVersion: ELIGIBILITY_ENGINE_VERSION,
        selectedRoute: text(row, "selectedRoute"), evaluatedAt: text(row, "evaluatedAt"),
        eligibilityState: eligibilityState as EvaluationEvidenceSnapshot["eligibilityState"],
        reason: text(row, "reason"), reevaluationReason: nullableText(row, "reevaluationReason"),
        supersedesEvaluationId: nullableText(row, "supersedesEvaluationId"), manualReviewReason: nullableText(row, "manualReviewReason"),
        matchedRuleIds: matchedRules.map((item) => item.ruleId),
        matchedRuleVersions: matchedRules.map((item) => ({ ruleId: item.ruleId, version: item.ruleVersion })),
        sourceAuthorities: [...new Set(matchedRules.map((item) => item.sourceAuthority))], matchedRules,
        requiredDocuments: json(row, "requiredDocuments", []), conditionalDocuments: json(row, "conditionalDocuments", []),
        warnings: json(row, "warnings", []), precedenceTrace: json(row, "precedenceTrace", matchedRules),
        evidenceSha256, evidenceIntegrityReference: `sha256:${evidenceSha256}`,
      });
    }
    for (const row of selectionRows) snapshots.select({
      id: text(row, "id"), applicationId, applicantId: number(row, "applicantId"),
      evaluationId: text(row, "evaluationId"), reason: text(row, "reason"),
      selectedBy: text(row, "selectedBy"), selectedAt: text(row, "selectedAt"),
    });

    const family = new InMemoryFamilyPersistenceRepository();
    for (const row of relationshipRows) {
      const relationship = text(row, "relationship");
      if (relationship === "LEAD_APPLICANT" || !relationshipTypes.has(relationship)) continue;
      family.appendRelationship({ id: text(row, "id"), applicationId,
        fromApplicantId: number(row, "fromApplicantId"), toApplicantId: number(row, "toApplicantId"),
        relationship: relationship as "SPOUSE" | "CHILD" | "PARENT" | "GUARDIAN" | "DEPENDENT" | "SIBLING" | "OTHER",
        eventType: text(row, "eventType") as "ESTABLISHED" | "REVOKED", reason: text(row, "reason"), occurredAt: text(row, "occurredAt") });
    }
    for (const row of requirementRows) {
      const kind = text(row, "kind");
      if (!requirementKinds.has(kind)) throw new Error("INVALID_REQUIREMENT_KIND");
      family.appendRequirementInstance({ id: text(row, "id"), applicationId, applicantId: number(row, "applicantId"),
        evaluationId: text(row, "evaluationId"), catalogVersion: text(row, "catalogVersion"), code: text(row, "code"),
        kind: kind as "DOCUMENT" | "QUESTION", critical: Boolean(value(row, "critical")),
        conditional: Boolean(value(row, "conditional")), createdAt: text(row, "createdAt") });
    }
    for (const row of requirementEventRows) {
      const state = text(row, "state");
      if (!requirementStates.has(state)) throw new Error("INVALID_REQUIREMENT_STATE");
      family.appendRequirementEvent({ id: text(row, "id"), instanceId: text(row, "instanceId"),
        state: state as "MISSING" | "UPLOADED" | "VALIDATED" | "WAIVED" | "CONDITIONAL_PENDING",
        reason: text(row, "reason"), occurredAt: text(row, "occurredAt") });
    }

    const supplierRow = supplierRows[0];
    const supplier: SupplierOperationalView | null = supplierRow ? {
      id: number(supplierRow, "id"), name: text(supplierRow, "name"), slaHours: null,
      reliabilityScore: null,
    } : null;
    const travelMembers = new Map<string, number[]>();
    for (const row of travelMemberRows) {
      const applicantId = number(row, "applicantId");
      if (!applicantIds.has(applicantId)) throw new Error("TRAVEL_GROUP_APPLICANT_OWNERSHIP_MISMATCH");
      const groupId = text(row, "travelGroupId");
      travelMembers.set(groupId, [...(travelMembers.get(groupId) ?? []), applicantId]);
    }
    const linkedDocuments = new Map<number, { documentType: string; applicantIds: number[] }>();
    for (const row of travelDocumentRows) {
      const applicantId = number(row, "applicantId");
      if (!applicantIds.has(applicantId)) throw new Error("TRAVEL_DOCUMENT_APPLICANT_OWNERSHIP_MISMATCH");
      const documentId = number(row, "documentId");
      const link = linkedDocuments.get(documentId) ?? { documentType: text(row, "documentType"), applicantIds: [] };
      link.applicantIds.push(applicantId); linkedDocuments.set(documentId, link);
    }
    const schedules = new Map<string, OperationsTravelGroup["scheduleHistory"][number][]>();
    for (const row of scheduleRows) {
      const groupId = text(row, "travelGroupId");
      const item = {
        evaluationId: text(row, "id"), evaluatedAt: text(row, "evaluatedAt"), travelGroupId: groupId,
        routeCode: text(row, "routeCode"), plannedArrivalDate: text(row, "plannedArrivalDate"),
        earliestSafeSubmissionDate: nullableText(row, "earliestSafeSubmissionDate"),
        targetSubmissionDate: nullableText(row, "targetSubmissionDate"), latestSafeSubmissionDate: nullableText(row, "latestSafeSubmissionDate"),
        state: text(row, "state") as SubmissionScheduleState, reason: text(row, "reason"),
        blockingReasons: json(row, "blockingReasons", []), recalculationReason: text(row, "recalculationReason"),
        ruleVersions: json(row, "ruleVersions", []), sourceEvidenceReferences: json(row, "sourceEvidenceReferences", []),
        evidenceSha256: text(row, "evidenceSha256"),
      };
      schedules.set(groupId, [...(schedules.get(groupId) ?? []), item]);
    }
    const travelGroups = travelGroupRows.map((row) => {
      const id = text(row, "id"); const members = travelMembers.get(id) ?? [];
      const primaryTravellerId = number(row, "primaryTravellerId");
      if (!applicantIds.has(primaryTravellerId) || members.some((member) => !applicantIds.has(member))) {
        throw new Error("TRAVEL_GROUP_APPLICANT_OWNERSHIP_MISMATCH");
      }
      const history = schedules.get(id) ?? [];
      return { id, reference: text(row, "reference"), arrangement: text(row, "arrangement") as "TOGETHER" | "SEPARATELY",
        primaryTravellerId, accompanyingAdultId: nullableNumber(row, "accompanyingAdultId") ?? null,
        applicantIds: members, origin: text(row, "origin"), destination: text(row, "destination"),
        plannedArrivalDate: text(row, "plannedArrivalDate"), plannedDepartureDate: nullableText(row, "plannedDepartureDate"),
        ticketStatus: text(row, "ticketStatus") as "NOT_BOOKED" | "RESERVED" | "CONFIRMED",
        sharedDocuments: [...linkedDocuments.entries()].filter(([, link]) => link.applicantIds.some((id) => members.includes(id)))
          .map(([documentId, link]) => ({ documentId, documentType: link.documentType, applicantIds: [...link.applicantIds].sort((a, b) => a - b) })),
        currentSchedule: history.at(-1) ?? null, scheduleHistory: history.slice(0, -1) };
    });
    const schedulerAlerts: SchedulerAlertEvent[] = schedulerAlertRows.map((row) => ({
      id: text(row, "id"), alertKey: text(row, "alertKey"), applicationId: number(row, "applicationId"),
      applicantId: nullableNumber(row, "applicantId") ?? null, travelGroupId: text(row, "travelGroupId"),
      scheduleEvaluationId: text(row, "scheduleEvaluationId"), type: text(row, "alertType") as SchedulerAlertType,
      severity: text(row, "severity") as SchedulerAlertSeverity, category: text(row, "category") as SchedulerQueueCategory,
      state: text(row, "alertState") as SchedulerAlertState, version: number(row, "version"), actorId: text(row, "actorReference"),
      reason: text(row, "reason"), context: json(row, "contextJson", {}), correlationId: text(row, "correlationId"),
      idempotencyKey: text(row, "idempotencyKey"), occurredAt: text(row, "occurredAt"),
    }));
    return {
      source: {
        summary: { applicationId, reference: text(application, "reference"), status: text(application, "status"),
          createdAt: text(application, "createdAt"), assignedActorId: nullableNumber(application, "assignedStaffId") === undefined
            ? undefined : `staff:${nullableNumber(application, "assignedStaffId")}`,
          teamId: nullableNumber(application, "teamId"), departmentId: nullableNumber(application, "departmentId"),
          legacy: selectionRows.length === 0 },
        applicants, documents, supplier,
        operationalHistory: timelineRows.map((row) => ({ id: text(row, "id"), event: text(row, "event"),
          actorType: text(row, "actorType"), occurredAt: text(row, "occurredAt") })), travelGroups, schedulerAlerts,
      }, snapshots, family,
    };
  }
}
