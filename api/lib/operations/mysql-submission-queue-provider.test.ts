import { describe, expect, it } from "vitest";
import type { OperationsSqlClient } from "./mysql-access-provider";
import { MysqlSubmissionQueueProvider } from "./mysql-submission-queue-provider";

class Sql implements OperationsSqlClient {
  queries: string[] = [];
  async query(sql: string): Promise<readonly object[]> {
    this.queries.push(sql);
    if (sql.includes("FROM submission_schedule_snapshots")) return [{ scheduleEvaluationId: "schedule-a", applicationId: 7, applicationReference: "TSH-SYN", travelGroupId: "trip-a", travelGroupReference: "Trip A", routeCode: "SYN", plannedArrivalDate: "2026-12-20", targetSubmissionDate: "2026-11-20", latestSafeSubmissionDate: "2026-11-25", schedulerState: "SCHEDULED_FOR_SUBMISSION", blockingReasons: [], assignedStaffId: 9, teamId: 3, departmentId: 2, readinessState: "READY_FOR_SUBMISSION", manualReviewRequired: 0,
      alertId: "alert-1", alertType: "DUE_SOON", alertSeverity: "WARNING", alertState: "CREATED", alertVersion: 1, alertReason: "SUBMISSION_DUE_SOON" }];
    return [{ applicationId: 7, displayName: "Synthetic Applicant" }];
  }
}

describe("MysqlSubmissionQueueProvider", () => {
  it("returns the latest schedule with operational ownership and applicant names", async () => {
    const provider = new MysqlSubmissionQueueProvider(new Sql());
    expect(await provider.list()).toEqual([expect.objectContaining({ applicationId: 7, applicantNames: ["Synthetic Applicant"], assignedActorId: "staff:9", teamId: 3,
      currentAlert: { id: "alert-1", type: "DUE_SOON", severity: "WARNING", state: "CREATED", version: 1, reason: "SUBMISSION_DUE_SOON" } })]);
  });
  it("never selects finance/payment/storage fields", async () => {
    const sql = new Sql(); await new MysqlSubmissionQueueProvider(sql).list(); const text = sql.queries.join(" ").toLowerCase();
    for (const field of ["supplier_cost", "internal_cost", "margin", "profit", "stripe", "payment", "storage_path"]) expect(text).not.toContain(field);
  });
});
