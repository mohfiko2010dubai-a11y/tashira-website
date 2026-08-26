import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./context";
import { createCustomerVisaAssistantRouter } from "./customer-visa-assistant-router";
import { InMemoryEligibilitySnapshotRepository } from "./lib/eligibility/snapshot-repository";
import { InMemoryFamilyPersistenceRepository } from "./lib/family/family-persistence";
const bundle = {
  source: {
    summary: {
      applicationId: 1,
      reference: "TSH-1",
      status: "documents_pending",
      createdAt: "2026-08-26T00:00:00Z",
      legacy: true,
    },
    applicants: [
      {
        applicantId: 2,
        applicantIndex: 0,
        displayName: "Applicant 1",
        nationality: null,
        residenceCountry: null,
        routeCompatible: true,
      },
    ],
    documents: [],
    supplier: null,
    operationalHistory: [],
  },
  snapshots: new InMemoryEligibilitySnapshotRepository(),
  family: new InMemoryFamilyPersistenceRepository(),
};
const flags = [
  {
    flagKey: "VISA_ASSISTANT" as const,
    environment: "TEST" as const,
    enabled: true,
    scopeType: "APPLICATION" as const,
    scopeReference: "TSH-1",
  },
  {
    flagKey: "CUSTOMER_OPERATIONS_PORTAL" as const,
    environment: "TEST" as const,
    enabled: true,
    scopeType: "APPLICATION" as const,
    scopeReference: "TSH-1",
  },
];
const router = createCustomerVisaAssistantRouter({
  flagContext: async () => ({ environment: "TEST" }),
  flags: async () => flags,
  load: async reference => (reference === "TSH-1" ? bundle : null),
});
function ctx(refs: string[]): TrpcContext {
  return {
    req: new Request("https://test.invalid"),
    resHeaders: new Headers(),
    isAdmin: false,
    customerApplicationReferences: new Set(refs),
  };
}
describe("customer visa assistant router", () => {
  it("answers an owned case and denies cross-application access", async () => {
    await expect(
      router
        .createCaller(ctx(["TSH-1"]))
        .answer({ applicationReference: "TSH-1", questionKey: "case.status" })
    ).resolves.toMatchObject({
      state: "ANSWERED",
      sourceType: "AUTHENTICATED_CASE",
    });
    await expect(
      router
        .createCaller(ctx(["TSH-OTHER"]))
        .answer({ applicationReference: "TSH-1", questionKey: "case.status" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
