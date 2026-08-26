import { describe, expect, it, vi } from "vitest";
import type { OperationsSqlClient } from "./mysql-access-provider";
import { MysqlOperationsManagerAnalyticsProvider } from "./mysql-manager-analytics-provider";

describe("MySQL Operations Manager analytics provider", () => {
  it("selects and maps operational evidence without finance or payment fields", async () => {
    const query = vi.fn(async (sql: string) => { expect(sql).toContain("FROM applications"); return [{ applicationId: 9, baseType: "family", status: "READY_FOR_SUBMISSION", supplierId: 4,
      assignedStaffId: 7, teamId: 2, departmentId: 3, applicantCount: 4, travelGroupCount: 1,
      dueAt: "2026-08-27", scheduleState: "READY_FOR_SUBMISSION", familyReadinessState: "READY_FOR_SUBMISSION", reworkCount: 1 }]; });
    const result = await new MysqlOperationsManagerAnalyticsProvider({ query } satisfies OperationsSqlClient).list();
    expect(result).toEqual([expect.objectContaining({ applicationId: 9, family: true, applicantCount: 4, readyForSubmission: true,
      assignedActorId: "staff:7", teamId: 2, departmentId: 3, supplierId: 4, reworkCount: 1 })]);
    const sql = String(query.mock.calls[0]?.[0]).toLowerCase();
    expect(sql).not.toMatch(/payment|stripe|price|amount|cost|margin|profit|storage/);
  });
});
