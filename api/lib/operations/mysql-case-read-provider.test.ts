import { describe, expect, it } from "vitest";
import type { OperationsSqlClient } from "./mysql-access-provider";
import { MysqlOperationsCaseReadProvider } from "./mysql-case-read-provider";

class FixtureSql implements OperationsSqlClient {
  readonly queries: string[] = [];
  async query(sql: string): Promise<readonly object[]> {
    this.queries.push(sql);
    if (sql.includes("FROM applications a")) return [{ id: 7, reference: "TSH-LEGACY-7", status: "submitted", createdAt: "2026-08-24T00:00:00.000Z", supplierId: 2, assignedStaffId: 11, teamId: 3, departmentId: 4 }];
    if (sql.includes("FROM applicants")) return [
      { id: 71, applicantIndex: 0, displayName: "Applicant A", nationality: "Egyptian", residenceCountry: "UAE" },
      { id: 72, applicantIndex: 1, displayName: "Applicant B", nationality: "Indian", residenceCountry: "KSA" },
    ];
    if (sql.includes("FROM documents")) return [
      { id: 701, applicantId: 71, code: "passport", uploadStatus: "uploaded" },
      { id: 702, applicantId: 72, code: "photo", uploadStatus: "uploaded" },
    ];
    if (sql.includes("FROM suppliers")) return [{ id: 2, name: "Operational Supplier" }];
    if (sql.includes("FROM travel_groups")) return [{ id: "trip-1", version: 2, reference: "TRIP-A", arrangement: "TOGETHER", primaryTravellerId: 71, accompanyingAdultId: 71, origin: "CAI", destination: "DXB", plannedArrivalDate: new Date("2026-12-20T00:00:00.000Z"), plannedDepartureDate: new Date("2026-12-30T00:00:00.000Z"), ticketStatus: "CONFIRMED" }];
    if (sql.includes("FROM travel_group_applicants")) return [{ travelGroupId: "trip-1", applicantId: 71 }, { travelGroupId: "trip-1", applicantId: 72 }];
    if (sql.includes("FROM travel_document_applicant_links")) return [{ documentId: 701, applicantId: 71, documentType: "FAMILY_BOOKING" }, { documentId: 701, applicantId: 72, documentType: "FAMILY_BOOKING" }];
    if (sql.includes("FROM submission_schedule_snapshots")) return [{ id: "schedule-1", travelGroupId: "trip-1", routeCode: "30-days", plannedArrivalDate: new Date("2026-12-20T00:00:00.000Z"), earliestSafeSubmissionDate: new Date("2026-11-20T00:00:00.000Z"), targetSubmissionDate: new Date("2026-12-12T00:00:00.000Z"), latestSafeSubmissionDate: new Date("2026-12-15T00:00:00.000Z"), state: "SCHEDULED_FOR_SUBMISSION", reason: "SUBMISSION_WINDOW_NOT_OPEN", blockingReasons: [], recalculationReason: "INITIAL_EVALUATION", ruleVersions: [], sourceEvidenceReferences: [], evaluatorVersion: "v1", evidenceSha256: "a".repeat(64), evaluatedAt: "2026-08-25T00:00:00.000Z" }];
    return [];
  }
}

describe("MysqlOperationsCaseReadProvider", () => {
  it("renders legacy data without inventing evaluation or family evidence", async () => {
    const sql = new FixtureSql();
    const result = await new MysqlOperationsCaseReadProvider(sql).load("TSH-LEGACY-7");
    expect(result?.source.summary.legacy).toBe(true);
    expect(result?.source.documents.map((item) => [item.applicantId, item.documentId])).toEqual([[71, 701], [72, 702]]);
    expect(result?.snapshots.current(7, 71)).toBeNull();
    expect(result?.family.currentRelationships(7)).toEqual([]);
  });

  it("loads applicant-isolated travel groups and immutable scheduler evidence", async () => {
    const result = await new MysqlOperationsCaseReadProvider(new FixtureSql()).load("TSH-LEGACY-7");
    expect(result?.source.travelGroups).toEqual([expect.objectContaining({
      id: "trip-1", version: 2, applicantIds: [71, 72], ticketStatus: "CONFIRMED",
      plannedArrivalDate: "2026-12-20", plannedDepartureDate: "2026-12-30",
      currentSchedule: expect.objectContaining({ state: "SCHEDULED_FOR_SUBMISSION", targetSubmissionDate: "2026-12-12" }),
      sharedDocuments: [{ documentId: 701, documentType: "FAMILY_BOOKING", applicantIds: [71, 72] }],
    })]);
  });

  it("uses finance-minimized SQL projections and never selects storage paths", async () => {
    const sql = new FixtureSql();
    await new MysqlOperationsCaseReadProvider(sql).load("TSH-LEGACY-7");
    const queryText = sql.queries.join("\n").toLowerCase();
    for (const forbidden of ["supplier_cost", "internal_cost", "margin", "markup", "gross_profit", "net_profit", "stripe_balance", "payout", "storage_path"]) {
      expect(queryText).not.toContain(forbidden);
    }
  });

  it("fails closed when a document belongs to an applicant outside the case", async () => {
    class CrossApplicantSql extends FixtureSql {
      override async query(sql: string): Promise<readonly object[]> {
        if (sql.includes("FROM documents")) return [{ id: 703, applicantId: 999, code: "passport", uploadStatus: "uploaded" }];
        return super.query(sql);
      }
    }
    await expect(new MysqlOperationsCaseReadProvider(new CrossApplicantSql()).load("TSH-LEGACY-7"))
      .rejects.toThrow("DOCUMENT_APPLICANT_OWNERSHIP_MISMATCH");
  });
});
