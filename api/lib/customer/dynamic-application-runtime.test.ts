import { describe, expect, it } from "vitest";
import type { FamilyEvaluation } from "../family/family-engine";
import type { FeatureFlagRecord } from "../feature-flags/feature-flags";
import type { MysqlRequirementCatalogProvider } from "../requirements/mysql-requirement-catalog-provider";
import { buildDynamicApplicationFromCatalog, comparePrecheckWithFinalEvaluation } from "./dynamic-application-runtime";

const enabled = (flagKey: FeatureFlagRecord["flagKey"]): FeatureFlagRecord => ({ flagKey, environment: "STAGING", enabled: true, scopeType: "GLOBAL", scopeReference: "" });
const family: FamilyEvaluation = { applicationId: 1, finalEligibilityState: "ELIGIBLE", manualReviewReasons: [], members: [{
  applicantId: 11, evaluationId: "eval-11", ruleVersions: [{ ruleId: "RULE", version: 2 }], eligibilityState: "ELIGIBLE",
  requiredDocuments: [{ applicantId: 11, code: "PASSPORT", evaluationId: "eval-11" }], conditionalDocuments: [], warnings: [],
}] };
const provider = { active: async () => ({ catalogVersion: "v1", requirements: [{
  kind: "DOCUMENT", definitionId: "00000000-0000-4000-8000-000000000001", code: "PASSPORT", version: 1, status: "ACTIVE",
  documentType: "PASSPORT", customerLabel: "Passport", shortCustomerExplanation: "Upload a clear passport copy.", internalLabel: "Passport",
  classification: "OFFICIAL", authoritySemantics: "Authority", reasonTemplate: "Required by the relevant authority for this visa route.", category: "IDENTITY",
  requiredCapability: true, conditionalCapability: false, sharedDocumentCapability: false, applicantScopedCapability: true,
  travelGroupScopedCapability: false, familyScopedCapability: false, aiExtractionCapability: true, humanReviewPolicy: "ON_WARNING",
  effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveTo: null, reviewStatus: "APPROVED",
}], questions: [] }) } satisfies Pick<MysqlRequirementCatalogProvider, "active">;

describe("dynamic application catalog runtime", () => {
  it("is closed unless every customer runtime flag is enabled", async () => {
    const result = await buildDynamicApplicationFromCatalog({ context: { environment: "STAGING", applicationReference: "TSH-1" }, flags: [], catalogProvider: provider,
      evaluatedAt: new Date("2026-08-26T00:00:00Z"), applicationId: 1, identities: [{ applicantId: 11, displayLabel: "Applicant 1", relationship: "LEAD_APPLICANT" }],
      family, answers: {}, travelQuestions: [], travelGroups: [], schedules: [] });
    expect(result).toEqual({ plan: null, requirements: null });
  });

  it("builds customer uploads from exact catalog evidence without frontend labels", async () => {
    const flags = [enabled("VISA_RULES_EVALUATION"), enabled("DYNAMIC_REQUIREMENTS"), enabled("DYNAMIC_CUSTOMER_APPLICATION")];
    const result = await buildDynamicApplicationFromCatalog({ context: { environment: "STAGING", applicationReference: "TSH-1" }, flags, catalogProvider: provider,
      evaluatedAt: new Date("2026-08-26T00:00:00Z"), applicationId: 1, identities: [{ applicantId: 11, displayLabel: "Applicant 1", relationship: "LEAD_APPLICANT" }],
      family, answers: {}, travelQuestions: [], travelGroups: [], schedules: [] });
    expect(result.plan?.applicants[0].uploads[0]).toMatchObject({ code: "PASSPORT", label: "Passport", definitionVersion: 1, sharingScope: "APPLICANT" });
  });

  it("preserves pre-check evidence and identifies a material final-rule change", () => {
    const result = comparePrecheckWithFinalEvaluation({ family, precheck: {
      outcome: "LIKELY_ELIGIBLE", routeCode: "UAE_VISIT", requiredDocumentCodes: [], conditionalDocumentCodes: [], warnings: [],
      disclaimer: "Guidance", ruleEvidence: [{ ruleId: "RULE", version: 1 }], operationalRequirements: [], travelPartyConditions: [],
      ticketRequirementCodes: [], submissionTimingWarnings: [], sourceVerificationStatus: "VERIFIED",
    } });
    expect(result).toMatchObject({ materiallyChanged: true, changeReason: "ACTIVE_RULE_VERSION_CHANGED_SINCE_PRECHECK" });
  });
});
