import type { OperationsSqlClient } from "./mysql-access-provider";
import type { OperationsAnalyticsCandidate } from "./manager-dashboard-service";

function value(row: object, key: string): unknown { return Reflect.get(row, key); }
function integer(row: object, key: string, fallback = 0): number { const parsed = Number(value(row, key)); return Number.isSafeInteger(parsed) ? parsed : fallback; }
function optionalInteger(row: object, key: string): number | null { const item = value(row, key); if (item === null || item === undefined) return null;
  const parsed = Number(item); return Number.isSafeInteger(parsed) ? parsed : null; }
function text(row: object, key: string, fallback = ""): string { const item = value(row, key); return typeof item === "string" ? item : fallback; }
function date(row: object, key: string): string | null { const item = value(row, key); if (item === null || item === undefined) return null;
  return item instanceof Date ? item.toISOString().slice(0, 10) : typeof item === "string" ? item.slice(0, 10) : null; }

/** Finance-minimized manager analytics source. No payment, pricing, cost, margin, profit or storage columns are selected. */
export class MysqlOperationsManagerAnalyticsProvider {
  private readonly sql: OperationsSqlClient;
  constructor(sql: OperationsSqlClient) { this.sql = sql; }

  async list(): Promise<OperationsAnalyticsCandidate[]> {
    const rows = await this.sql.query(`SELECT a.id AS applicationId,a.base_type AS baseType,
      CASE COALESCE(latest_action.to_state,a.status)
        WHEN 'completed' THEN 'COMPLETED' WHEN 'cancelled' THEN 'CANCELLED' WHEN 'rejected' THEN 'REJECTED'
        WHEN 'visa_received' THEN 'VISA_ISSUED' ELSE COALESCE(latest_action.to_state,UPPER(a.status)) END AS status,
      a.supplier_id AS supplierId,c.assigned_staff_user_id AS assignedStaffId,c.team_id AS teamId,t.department_id AS departmentId,
      (SELECT COUNT(*) FROM applicants ap WHERE ap.application_id=a.id) AS applicantCount,
      (SELECT COUNT(*) FROM travel_groups g WHERE g.application_id=a.id) AS travelGroupCount,
      latest_schedule.target_submission_date AS dueAt,latest_schedule.schedule_state AS scheduleState,
      latest_family.family_readiness_state AS familyReadinessState,
      EXISTS(SELECT 1 FROM document_intelligence_runs intelligence WHERE intelligence.application_id=a.id
        AND intelligence.processing_tier IN ('ADVANCED_AI','HUMAN_REVIEW')) AS documentIntelligenceEscalated,
      (SELECT COUNT(*) FROM applicants review_applicant WHERE review_applicant.application_id=a.id
        AND EXISTS(SELECT 1 FROM visa_rule_evaluations evaluation WHERE evaluation.applicant_id=review_applicant.id
          AND evaluation.id=(SELECT current_evaluation.id FROM visa_rule_evaluations current_evaluation
            WHERE current_evaluation.applicant_id=review_applicant.id ORDER BY current_evaluation.evaluated_at DESC,current_evaluation.id DESC LIMIT 1)
          AND evaluation.final_eligibility_state IN ('HUMAN_REVIEW_REQUIRED','RULE_CONFLICT'))) AS manualReviewApplicantCount,
      (SELECT COUNT(*) FROM operations_action_events rework WHERE rework.application_id=a.id
        AND rework.action_type='DOCUMENT_REVIEW' AND rework.outcome IN ('REJECTED','NEEDS_REPLACEMENT','UNREADABLE','MISMATCH')) AS reworkCount
      FROM applications a
      LEFT JOIN operations_case_controls c ON c.application_id=a.id
      LEFT JOIN operations_teams t ON t.id=c.team_id
      LEFT JOIN operations_action_events latest_action ON latest_action.id=(SELECT action.id FROM operations_action_events action
        WHERE action.application_id=a.id AND action.action_type='STATUS_TRANSITION' ORDER BY action.created_at DESC,action.id DESC LIMIT 1)
      LEFT JOIN submission_schedule_snapshots latest_schedule ON latest_schedule.id=(SELECT schedule.id FROM submission_schedule_snapshots schedule
        WHERE schedule.application_id=a.id ORDER BY schedule.evaluated_at DESC,schedule.id DESC LIMIT 1)
      LEFT JOIN family_readiness_snapshots latest_family ON latest_family.id=(SELECT family.id FROM family_readiness_snapshots family
        WHERE family.application_id=a.id ORDER BY family.evaluated_at DESC,family.id DESC LIMIT 1)
      ORDER BY a.id`);
    return rows.map((row) => { const scheduleState = text(row, "scheduleState"); const familyState = text(row, "familyReadinessState");
      return { applicationId: integer(row, "applicationId"), applicantCount: integer(row, "applicantCount"),
        family: text(row, "baseType") === "family", travelGroupCount: integer(row, "travelGroupCount"), status: text(row, "status"),
        waitingForCustomer: familyState === "NOT_READY", scheduledSubmission: scheduleState === "SCHEDULED_FOR_SUBMISSION",
        dueAt: date(row, "dueAt"), readyForTyping: false, readyForSubmission: scheduleState === "READY_FOR_SUBMISSION",
        authorityQueryOpen: false, reworkCount: integer(row, "reworkCount"), assignedStaffId: optionalInteger(row, "assignedStaffId"),
        reviewMinutes: null, typingMinutes: null, supplierId: optionalInteger(row, "supplierId"),
        documentIntelligenceEscalated: Boolean(value(row, "documentIntelligenceEscalated")), manualReviewApplicantCount: integer(row, "manualReviewApplicantCount"),
        assignedActorId: optionalInteger(row, "assignedStaffId") === null ? undefined : `staff:${optionalInteger(row, "assignedStaffId")}`,
        teamId: optionalInteger(row, "teamId") ?? undefined, departmentId: optionalInteger(row, "departmentId") ?? undefined };
    });
  }
}
