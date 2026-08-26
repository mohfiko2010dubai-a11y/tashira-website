import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./context";
import { ROLE_TEMPLATES } from "./lib/authorization/permissions";
import type { AuthorizationActor } from "./lib/authorization/policy";
import { InMemoryEligibilitySnapshotRepository } from "./lib/eligibility/snapshot-repository";
import { InMemoryFamilyPersistenceRepository } from "./lib/family/family-persistence";
import type { FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import type { MysqlOperationsCaseBundle } from "./lib/operations/mysql-case-read-provider";
import type { OperationsAnalyticsCandidate } from "./lib/operations/manager-dashboard-service";
import { createOperationsReadRouter } from "./operations-read-router";

const context = (staffId?: number): TrpcContext => ({
  req: new Request("https://staging.invalid/api/trpc"), resHeaders: new Headers(), isAdmin: staffId === undefined,
  staffId, customerApplicationReferences: new Set(),
});
const bundle = (): MysqlOperationsCaseBundle => ({
  source: {
    summary: { applicationId: 1, reference: "TSH-OPS-1", status: "submitted", createdAt: "2026-08-24T00:00:00.000Z", assignedActorId: "staff:10", teamId: 3, departmentId: 4, legacy: true },
    applicants: [{ applicantId: 11, applicantIndex: 0, displayName: "Applicant", nationality: "Egyptian", residenceCountry: "UAE", routeCompatible: true }],
    documents: [{ documentId: 21, applicantId: 11, code: "passport", readiness: "UPLOADED" }],
    supplier: { id: 5, name: "Supplier", slaHours: null, reliabilityScore: null, effectiveCost: "100", internalCost: "90" },
    operationalHistory: [],
  }, snapshots: new InMemoryEligibilitySnapshotRepository(), family: new InMemoryFamilyPersistenceRepository(),
});
const enabled: FeatureFlagRecord[] = [{ flagKey: "OPERATIONS_CASE_READ_MODEL", environment: "STAGING", enabled: true, scopeType: "STAFF", scopeReference: "10" }];
const actor = (teamIds = [3]): AuthorizationActor => ({ id: "staff:10", permissions: new Set(ROLE_TEMPLATES.OPERATIONS_MANAGER), scopes: ["TEAM"], teamIds: new Set(teamIds), departmentIds: new Set() });
const analyticsCandidate = (teamId = 3): OperationsAnalyticsCandidate => ({ applicationId: 1, teamId, applicantCount: 2, family: true,
  travelGroupCount: 1, status: "DOCUMENTS_PENDING", waitingForCustomer: true, scheduledSubmission: false, dueAt: "2026-08-27",
  readyForTyping: false, readyForSubmission: false, authorityQueryOpen: false, reworkCount: 0, assignedStaffId: 10,
  reviewMinutes: null, typingMinutes: null, supplierId: 5 });

function router(flags = enabled, currentActor = actor()) {
  return createOperationsReadRouter({
    actorForContext: async () => currentActor,
    flagContextForContext: async () => ({ environment: "STAGING", staffId: 10, teamIds: currentActor.teamIds }),
    flagsForContext: async () => flags,
    load: async (reference) => reference === "TSH-OPS-1" ? bundle() : null,
    loadManagerAnalytics: async () => [analyticsCandidate()],
    submissionQueuePolicy: () => ({ dueSoonDays: 7, urgentDays: 2 }),
  });
}

describe("operations read router", () => {
  it("requires a staff session even when an admin cookie exists", async () => {
    await expect(router().createCaller(context()).caseByReference({ reference: "TSH-OPS-1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("fails closed while the feature flag is disabled", async () => {
    await expect(router([]).createCaller(context(10)).caseByReference({ reference: "TSH-OPS-1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("denies the wrong team", async () => {
    await expect(router(enabled, actor([9])).createCaller(context(10)).caseByReference({ reference: "TSH-OPS-1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("returns an applicant-isolated legacy model without finance fields", async () => {
    const model = await router().createCaller(context(10)).caseByReference({ reference: "TSH-OPS-1" });
    expect(model.mode).toBe("LEGACY_NOT_EVALUATED");
    expect(model.applicants[0].documents).toHaveLength(1);
    expect(model.supplier).toEqual({ id: 5, name: "Supplier", slaHours: null, reliabilityScore: null });
  });
  it("returns safe NOT_FOUND only after authorization gates pass", async () => {
    await expect(router().createCaller(context(10)).caseByReference({ reference: "TSH-MISSING" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("returns manager analytics only for the trusted manager scope without finance fields", async () => {
    const model = await router().createCaller(context(10)).managerDashboard({});
    expect(model).toMatchObject({ applications: 1, applicants: 2, families: 1, financeFieldsIncluded: false });
    expect(JSON.stringify(model)).not.toMatch(/cost|margin|profit|payment|stripe/i);
  });
  it("denies manager analytics to an employee without case.read", async () => {
    const employee: AuthorizationActor = { ...actor(), permissions: new Set(["case.read_assigned"]) };
    await expect(router(enabled, employee).createCaller(context(10)).managerDashboard({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
