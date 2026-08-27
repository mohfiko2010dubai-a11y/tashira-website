import { describe, expect, it } from "vitest";
import type { OperationsSqlClient } from "../operations/mysql-access-provider";
import { MysqlOperationalSubmissionPolicyProvider } from "./mysql-operational-submission-policy-provider";

const thresholds = { scheduledAfterDays: 45, recommendedMinDays: 21, recommendedMaxDays: 45,
  readyMinDays: 8, readyMaxDays: 20, urgentMinDays: 4, urgentMaxDays: 7,
  humanReviewMinDays: 0, humanReviewMaxDays: 3, dueSoonDays: 14, alertUrgentDays: 7, dueTodayDays: 0 };

describe("MySQL operational submission policy provider", () => {
  it("loads exactly one governed active policy", async () => {
    const sql: OperationsSqlClient = { query: async (query) => {
      expect(query).toContain("lifecycle_state='ACTIVE'");
      return [{ policyId: "policy-v1", policyCode: "SUBMISSION_SCHEDULER", version: 1, classification: "OPERATIONAL",
        state: "ACTIVE", recordVersion: 4, thresholds: JSON.stringify(thresholds), sourceReference: "OWNER_APPROVED_V1_POLICY",
        effectiveFrom: new Date("2026-08-27T00:00:00Z"), effectiveTo: null, evidenceSha256: "a".repeat(64) }];
    } };
    expect((await new MysqlOperationalSubmissionPolicyProvider(sql).active(new Date())).thresholds.alertUrgentDays).toBe(7);
  });
  it("fails closed for missing or conflicting active policy", async () => {
    await expect(new MysqlOperationalSubmissionPolicyProvider({ query: async () => [] }).active(new Date()))
      .rejects.toThrow("OPERATIONAL_POLICY_NOT_CONFIGURED");
    await expect(new MysqlOperationalSubmissionPolicyProvider({ query: async () => [{}, {}] }).active(new Date()))
      .rejects.toThrow("OPERATIONAL_POLICY_ACTIVE_CONFLICT");
  });
});
