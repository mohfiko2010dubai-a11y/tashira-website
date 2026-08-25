import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./context";
import { createCustomerOperationsRouter } from "./customer-operations-router";
import { InMemoryEligibilitySnapshotRepository } from "./lib/eligibility/snapshot-repository";
import { InMemoryFamilyPersistenceRepository } from "./lib/family/family-persistence";
import type { FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import type { MysqlOperationsCaseBundle } from "./lib/operations/mysql-case-read-provider";

const reference = "TSH-CUSTOMER-1";
const enabled: FeatureFlagRecord = {
  flagKey: "CUSTOMER_OPERATIONS_PORTAL", environment: "STAGING", enabled: true,
  scopeType: "APPLICATION", scopeReference: reference,
};

function context(references: readonly string[] = []): TrpcContext {
  return {
    req: new Request("https://staging.invalid/api/trpc"), resHeaders: new Headers(), isAdmin: false,
    customerApplicationReferences: new Set(references),
  };
}

function bundle(): MysqlOperationsCaseBundle {
  return {
    source: {
      summary: { applicationId: 1, reference, status: "documents_pending", createdAt: "2026-08-25T08:00:00Z", legacy: true },
      applicants: [
        { applicantId: 11, applicantIndex: 0, displayName: "Lead Applicant", nationality: "Egyptian", residenceCountry: "UAE", routeCompatible: true },
        { applicantId: 12, applicantIndex: 1, displayName: "Child", nationality: "Egyptian", residenceCountry: "UAE", routeCompatible: true },
      ],
      documents: [
        { documentId: 21, applicantId: 11, code: "passport", readiness: "UPLOADED" },
        { documentId: 22, applicantId: 12, code: "photo", readiness: "MISSING" },
      ],
      supplier: { id: 5, name: "Internal Supplier", slaHours: 24, reliabilityScore: 99, effectiveCost: "100", internalCost: "90" },
      operationalHistory: [
        { id: "event-1", event: "APPLICATION_CREATED", actorType: "CUSTOMER", occurredAt: "2026-08-25T08:00:00Z" },
        { id: "event-2", event: "MISSING_DOCUMENTS", actorType: "STAFF", occurredAt: "2026-08-25T09:00:00Z" },
      ],
    },
    snapshots: new InMemoryEligibilitySnapshotRepository(),
    family: new InMemoryFamilyPersistenceRepository(),
  };
}

function router(flags: readonly FeatureFlagRecord[] = [enabled]) {
  return createCustomerOperationsRouter({
    flagContextForContext: async () => ({ environment: "STAGING" }),
    flagsForContext: async () => flags,
    load: async (candidate) => candidate === reference ? bundle() : null,
  });
}

describe("customer operations runtime router", () => {
  it("denies anonymous and cross-application access before reading the case", async () => {
    await expect(router().createCaller(context()).portal({ referenceNumber: reference }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(router().createCaller(context(["TSH-OTHER"])).portal({ referenceNumber: reference }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fails closed unless the application-scoped portal flag is enabled", async () => {
    await expect(router([]).createCaller(context([reference])).portal({ referenceNumber: reference }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns only the authenticated customer's finance-free projection", async () => {
    const result = await router().createCaller(context([reference])).portal({ referenceNumber: reference });
    expect(result.applicationReference).toBe(reference);
    expect(result.applicants.map(({ applicantId }) => applicantId)).toEqual([11, 12]);
    expect(result.timeline.map(({ status }) => status)).toEqual(["APPLICATION_RECEIVED", "ADDITIONAL_DOCUMENTS_REQUIRED"]);
    expect(JSON.stringify(result)).not.toMatch(/Supplier|cost|margin|profit|reasonCode/i);
  });

  it("does not disclose missing applications while the feature is disabled", async () => {
    await expect(router([]).createCaller(context(["TSH-MISSING"])).portal({ referenceNumber: "TSH-MISSING" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
