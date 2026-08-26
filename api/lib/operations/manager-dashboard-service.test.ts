import { describe, expect, it } from "vitest";
import type { AuthorizationActor } from "../authorization/policy";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import { readOperationsManagerDashboard, type OperationsAnalyticsCandidate } from "./manager-dashboard-service";

const flag: FeatureFlagRecord = { flagKey: "OPERATIONS_CASE_READ_MODEL", environment: "TEST", enabled: true, scopeType: "TEAM", scopeReference: "7" };
const manager: AuthorizationActor = { id: "staff:1", permissions: new Set(["case.read"]), scopes: ["TEAM"], teamIds: new Set([7]), departmentIds: new Set() };
const candidate = (applicationId: number, teamId: number): OperationsAnalyticsCandidate => ({ applicationId, teamId, applicantCount: 1,
  family: false, travelGroupCount: 1, status: "DOCUMENTS_PENDING", waitingForCustomer: true, scheduledSubmission: false,
  dueAt: "2026-08-27", readyForTyping: false, readyForSubmission: false, authorityQueryOpen: false, reworkCount: 0,
  assignedStaffId: null, reviewMinutes: null, typingMinutes: null, supplierId: 4 });

describe("Operations Manager dashboard read gate", () => {
  it("aggregates only cases inside the trusted manager scope", () => {
    const result = readOperationsManagerDashboard({ actor: manager, context: { environment: "TEST", teamIds: new Set([7]) }, flags: [flag],
      candidates: [candidate(1, 7), candidate(2, 8)], now: new Date("2026-08-26T00:00:00Z"), dueSoonDays: 7, urgentDays: 2 });
    expect(result).toMatchObject({ applications: 1, applicants: 1, waitingForCustomer: 1, financeFieldsIncluded: false });
    expect(JSON.stringify(result)).not.toMatch(/cost|margin|profit|payment|stripe/i);
  });
  it("fails closed for employees without manager case.read and while the flag is closed", () => {
    expect(() => readOperationsManagerDashboard({ actor: { ...manager, permissions: new Set(["case.read_assigned"]) },
      context: { environment: "TEST", teamIds: new Set([7]) }, flags: [flag], candidates: [candidate(1, 7)],
      now: new Date(), dueSoonDays: 7, urgentDays: 2 })).toThrow("OPERATIONS_MANAGER_DASHBOARD_ACCESS_DENIED");
    expect(() => readOperationsManagerDashboard({ actor: manager, context: { environment: "TEST", teamIds: new Set([7]) }, flags: [],
      candidates: [candidate(1, 7)], now: new Date(), dueSoonDays: 7, urgentDays: 2 })).toThrow("OPERATIONS_MANAGER_DASHBOARD_DISABLED");
  });
});
