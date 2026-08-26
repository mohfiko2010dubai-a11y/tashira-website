import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OperationsManagerDashboard from "./OperationsManagerDashboard";
import type { OperationsManagerDashboard as DashboardModel } from "../../../api/lib/operations/manager-analytics";

const model: DashboardModel = { openCases: 3, waitingForCustomer: 1, scheduledSubmissions: 1, dueSoon: 1, urgent: 0,
  dueToday: 0, overdue: 0, readyForTyping: 0, readyForSubmission: 1, submitted: 0, authorityQueries: 0, slaRisk: 0,
  rework: 1, issued: 2, rejected: 0, applications: 5, applicants: 8, families: 2, travelGroups: 2,
  averageReviewMinutes: null, averageTypingMinutes: null, employeeWorkload: [{ staffId: 7, openCases: 2 }],
  supplierOperationalPerformance: [{ supplierId: 4, caseCount: 3, issued: 2, rejected: 0 }], financeFieldsIncluded: false };

describe("Operations manager dashboard", () => {
  it("renders scoped operational metrics and supplier identity without finance data", () => {
    const html = renderToStaticMarkup(<OperationsManagerDashboard model={model} />);
    expect(html).toContain("Open cases"); expect(html).toContain("Staff #7"); expect(html).toContain("Supplier #4");
    expect(html).toContain("Financial fields are not available"); expect(html).not.toMatch(/margin|profit|payment|stripe/i);
  });
});
