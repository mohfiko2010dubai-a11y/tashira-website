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
