import { describe, expect, it } from "vitest";
import type { FeatureFlagRecord, OperationsFlag } from "../feature-flags/feature-flags";
import type { DynamicRequirementView } from "../requirements/dynamic-requirements";
import { buildDynamicCustomerApplicationBehindFlags, runCustomerPrecheckBehindFlag } from "./customer-experience-service";

const enabled = (flagKey: OperationsFlag): FeatureFlagRecord => ({ flagKey, environment: "STAGING", enabled: true, scopeType: "GLOBAL", scopeReference: "" });
const requirements: DynamicRequirementView = {
  catalogVersion: "v1", familyEligibilityState: "ELIGIBLE",
  applicants: [{ applicantId: 1, evaluationId: "eval", documents: [], questions: [], warnings: [], manualReviewRequired: false }],
};

describe("customer experience feature gates", () => {
  it("keeps the dynamic customer application closed unless every dependency is enabled", () => {
    const common = { context: { environment: "STAGING" as const }, applicationId: 1,
      identities: [{ applicantId: 1, displayLabel: "Applicant 1", relationship: "LEAD_APPLICANT" as const }],
      requirements, travelQuestions: [], travelGroups: [], schedules: [] };
    expect(buildDynamicCustomerApplicationBehindFlags({ ...common, flags: [enabled("DYNAMIC_CUSTOMER_APPLICATION")] })).toBeNull();
    expect(buildDynamicCustomerApplicationBehindFlags({ ...common, flags: [enabled("DYNAMIC_CUSTOMER_APPLICATION"), enabled("DYNAMIC_REQUIREMENTS"), enabled("VISA_RULES_EVALUATION")] })).not.toBeNull();
  });

  it("keeps public pre-check closed by default", () => {
    const input = { context: { environment: "STAGING" as const }, profile: { routeCode: "UNKNOWN", attributes: {} }, approvedPublicRules: [], evaluatedAt: new Date("2026-08-25") };
    expect(runCustomerPrecheckBehindFlag({ ...input, flags: [] })).toBeNull();
    expect(runCustomerPrecheckBehindFlag({ ...input, flags: [enabled("CUSTOMER_PRECHECK")] })?.outcome).toBe("HUMAN_REVIEW_REQUIRED");
  });
});
