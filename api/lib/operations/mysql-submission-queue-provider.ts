import type { OperationsSqlClient } from "./mysql-access-provider";
import type { SubmissionQueueCandidate } from "./submission-queue";
import type { SubmissionScheduleState } from "../travel/submission-scheduler";

function value(row: object, key: string): unknown { return Reflect.get(row, key); }
function text(row: object, key: string, fallback = ""): string { const item = value(row, key); return typeof item === "string" ? item : item instanceof Date ? item.toISOString().slice(0, 10) : fallback; }
function number(row: object, key: string): number { const item = Number(value(row, key)); if (!Number.isSafeInteger(item)) throw new Error(`INVALID_SUBMISSION_QUEUE_ROW:${key}`); return item; }
function optionalNumber(row: object, key: string): number | undefined { const item = value(row, key); if (item === null || item === undefined) return undefined; const parsed = Number(item); return Number.isSafeInteger(parsed) ? parsed : undefined; }
function json<T>(row: object, key: string, fallback: T): T { const item = value(row, key); return item === null || item === undefined ? fallback : typeof item === "string" ? JSON.parse(item) as T : item as T; }

/** Finance-minimized read provider. No supplier, payment, pricing or storage columns are selected. */
export class MysqlSubmissionQueueProvider {
  private readonly sql: OperationsSqlClient;

  constructor(sql: OperationsSqlClient) { this.sql = sql; }

  async list(): Promise<SubmissionQueueCandidate[]> {
    const rows = await this.sql.query(
      `SELECT s.application_id AS applicationId, a.reference_number AS applicationReference,
              s.travel_group_id AS travelGroupId, g.travel_group_reference AS travelGroupReference,
              s.route_code AS routeCode, s.planned_arrival_date AS plannedArrivalDate,
              s.target_submission_date AS targetSubmissionDate, s.latest_safe_submission_date AS latestSafeSubmissionDate,
              s.schedule_state AS schedulerState, s.blocking_reasons_json AS blockingReasons,
              c.assigned_staff_user_id AS assignedStaffId, c.team_id AS teamId, t.department_id AS departmentId,
              COALESCE(f.family_readiness_state,'NOT_EVALUATED') AS readinessState,
              COALESCE(f.manual_review_required,0) AS manualReviewRequired
         FROM submission_schedule_snapshots s
         JOIN travel_groups g ON g.id=s.travel_group_id AND g.application_id=s.application_id
         JOIN applications a ON a.id=s.application_id
         LEFT JOIN operations_case_controls c ON c.application_id=s.application_id
         LEFT JOIN operations_teams t ON t.id=c.team_id
         LEFT JOIN family_readiness_snapshots f ON f.id=(
           SELECT f2.id FROM family_readiness_snapshots f2 WHERE f2.application_id=s.application_id ORDER BY f2.evaluated_at DESC,f2.id DESC LIMIT 1)
        WHERE NOT EXISTS (SELECT 1 FROM submission_schedule_snapshots newer
                           WHERE newer.travel_group_id=s.travel_group_id
                             AND (newer.evaluated_at>s.evaluated_at OR (newer.evaluated_at=s.evaluated_at AND newer.id>s.id)))
        ORDER BY s.target_submission_date,s.application_id,s.travel_group_id`, [],
    );
    const applicationIds = [...new Set(rows.map((row) => number(row, "applicationId")))];
    const nameRows = applicationIds.length === 0 ? [] : await this.sql.query(
      `SELECT application_id AS applicationId, full_name AS displayName
         FROM applicants WHERE application_id IN (${applicationIds.map(() => "?").join(",")})
        ORDER BY application_id,applicant_index,id`, applicationIds,
    );
    const names = new Map<number, string[]>();
    for (const row of nameRows) {
      const applicationId = number(row, "applicationId");
      names.set(applicationId, [...(names.get(applicationId) ?? []), text(row, "displayName", "Applicant")]);
    }
    return rows.map((row) => {
      const applicationId = number(row, "applicationId");
      return { applicationId, applicationReference: text(row, "applicationReference"), travelGroupId: text(row, "travelGroupId"),
        travelGroupReference: text(row, "travelGroupReference"), applicantNames: names.get(applicationId) ?? [],
        routeCode: text(row, "routeCode"), plannedArrivalDate: text(row, "plannedArrivalDate"),
        targetSubmissionDate: text(row, "targetSubmissionDate") || null, latestSafeSubmissionDate: text(row, "latestSafeSubmissionDate") || null,
        schedulerState: text(row, "schedulerState") as SubmissionScheduleState,
        readinessState: text(row, "readinessState"), blockingReasons: json(row, "blockingReasons", []),
        manualReviewRequired: Boolean(value(row, "manualReviewRequired")),
        assignedActorId: optionalNumber(row, "assignedStaffId") === undefined ? undefined : `staff:${optionalNumber(row, "assignedStaffId")}`,
        teamId: optionalNumber(row, "teamId"), departmentId: optionalNumber(row, "departmentId") };
    });
  }
}
