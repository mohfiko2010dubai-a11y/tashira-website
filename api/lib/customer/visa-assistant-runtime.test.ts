import { describe, expect, it } from "vitest";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import { answerCustomerVisaAssistant } from "./visa-assistant-runtime";
import { InMemoryEligibilitySnapshotRepository } from "../eligibility/snapshot-repository";
import { InMemoryFamilyPersistenceRepository } from "../family/family-persistence";
const flags: readonly FeatureFlagRecord[] = [
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
describe("customer visa assistant runtime", () => {
  it("answers only from the authenticated canonical portal", () => {
    expect(
      answerCustomerVisaAssistant({
        bundle,
        context: { environment: "TEST", applicationReference: "TSH-1" },
        flags,
        applicationReference: "TSH-1",
        customerAuthorized: true,
        questionKey: "case.status",
      })
    ).toMatchObject({ state: "ANSWERED", sourceType: "AUTHENTICATED_CASE" });
  });
  it("fails closed for flag and unknown knowledge", () => {
    expect(
      answerCustomerVisaAssistant({
        bundle,
        context: { environment: "TEST", applicationReference: "TSH-1" },
        flags: [],
        applicationReference: "TSH-1",
        customerAuthorized: true,
        questionKey: "case.status",
      })
    ).toBeNull();
    expect(
      answerCustomerVisaAssistant({
        bundle,
        context: { environment: "TEST", applicationReference: "TSH-1" },
        flags,
        applicationReference: "TSH-1",
        customerAuthorized: true,
        questionKey: "unknown",
      })
    ).toMatchObject({ state: "HUMAN_REVIEW_REQUIRED", sourceType: "NONE" });
  });
});
