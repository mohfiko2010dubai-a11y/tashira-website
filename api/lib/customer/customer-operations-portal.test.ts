import { describe, expect, it } from "vitest";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import { buildCustomerOperationsPortalBehindFlag } from "./customer-operations-portal";

const flag: FeatureFlagRecord = { flagKey: "CUSTOMER_OPERATIONS_PORTAL", environment: "STAGING", enabled: true, scopeType: "APPLICATION", scopeReference: "TSH-1" };
const base = {
  context: { environment: "STAGING" as const, applicationReference: "TSH-1" }, flags: [flag], applicationReference: "TSH-1", customerAuthorized: true,
  applicants: [
    { applicantId: 1, label: "Father", requirementSummary: { complete: 2, total: 2, outstandingLabels: [] } },
    { applicantId: 2, label: "Child 1", requirementSummary: { complete: 1, total: 2, outstandingLabels: ["Parental consent"] } },
  ],
  statusEvents: [
    { eventId: "event-2", applicationId: 1, status: "DOCUMENTS_REQUIRED" as const, occurredAt: "2026-08-25T10:00:00Z", actorType: "SYSTEM" as const, reasonCode: "INTERNAL_REASON_MUST_NOT_LEAK" },
    { eventId: "event-1", applicationId: 1, status: "APPLICATION_RECEIVED" as const, occurredAt: "2026-08-25T09:00:00Z", actorType: "CUSTOMER" as const, reasonCode: "CREATED" },
  ], schedules: [],
};

describe("customer operations portal", () => {
  it("stays closed unless the application-scoped flag is enabled", () => {
    expect(buildCustomerOperationsPortalBehindFlag({ ...base, flags: [] })).toBeNull();
  });
  it("sorts immutable timeline evidence and exposes customer-safe status only", () => {
    const portal = buildCustomerOperationsPortalBehindFlag(base);
    expect(portal?.timeline.map(({ eventId }) => eventId)).toEqual(["event-1", "event-2"]);
    expect(portal?.currentStatus.code).toBe("DOCUMENTS_REQUIRED");
    expect(JSON.stringify(portal)).not.toContain("INTERNAL_REASON_MUST_NOT_LEAK");
    expect(portal?.requiredCustomerActions).toEqual(["Child 1: Parental consent"]);
  });
  it("requires authenticated customer ownership", () => {
    expect(() => buildCustomerOperationsPortalBehindFlag({ ...base, customerAuthorized: false })).toThrow("CUSTOMER_PORTAL_AUTHORIZATION_REQUIRED");
  });
});
