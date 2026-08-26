import { describe, expect, it } from "vitest";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";
import { InMemoryFamilyPersistenceRepository } from "../family/family-persistence";
import { requestCustomerCaseHandoff } from "./case-handoff-runtime";

const flags: readonly FeatureFlagRecord[] = [
  {
    flagKey: "CASE_CHAT_HANDOFF",
    environment: "TEST",
    enabled: true,
    scopeType: "APPLICATION",
    scopeReference: "TSH-1",
  },
  {
    flagKey: "VISA_ASSISTANT",
    environment: "TEST",
    enabled: true,
    scopeType: "APPLICATION",
    scopeReference: "TSH-1",
  },
  {
    flagKey: "CUSTOMER_OPERATIONS_PORTAL",
    environment: "TEST",
    enabled: true,
    scopeType: "APPLICATION",
    scopeReference: "TSH-1",
  },
];
const bundle = {
  source: {
    summary: {
      applicationId: 1,
      reference: "TSH-1",
      status: "documents_pending",
      createdAt: "2026-08-26T00:00:00Z",
      teamId: 7,
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

describe("customer case handoff runtime", () => {
  it("fails closed without a current immutable evaluation", async () => {
    await expect(
      requestCustomerCaseHandoff({
        bundle,
        context: { environment: "TEST", applicationReference: "TSH-1" },
        flags,
        applicationReference: "TSH-1",
        customerAuthorized: true,
        questionKey: "case.status",
        requestId: "11111111-1111-4111-8111-111111111111",
        requestFingerprint: "fingerprint",
        now: new Date("2026-08-26T12:00:00Z"),
        repository: { create: async input => input },
      })
    ).rejects.toThrow("CASE_HANDOFF_CURRENT_EVALUATION_REQUIRED");
  });
  it("does not call persistence while the handoff flag is closed", async () => {
    let calls = 0;
    await expect(
      requestCustomerCaseHandoff({
        bundle,
        context: { environment: "TEST", applicationReference: "TSH-1" },
        flags: [],
        applicationReference: "TSH-1",
        customerAuthorized: true,
        questionKey: "case.status",
        requestId: "11111111-1111-4111-8111-111111111111",
        requestFingerprint: "fingerprint",
        now: new Date("2026-08-26T12:00:00Z"),
        repository: {
          create: async input => {
            calls += 1;
            return input;
          },
        },
      })
    ).resolves.toBeNull();
    expect(calls).toBe(0);
  });
});
