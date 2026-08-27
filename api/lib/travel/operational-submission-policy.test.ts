import { describe, expect, it } from "vitest";
import type { AuthorizationActor } from "../authorization/policy";
import { createOperationalSubmissionPolicy, InMemoryOperationalSubmissionPolicyRepository } from "./operational-submission-policy";

const actor = (permissions: ("rule.propose" | "rule.review" | "rule.activate")[]): AuthorizationActor => ({
  id: "staff:7", permissions: new Set(permissions), scopes: ["ALL"], teamIds: new Set(), departmentIds: new Set(),
});
const thresholds = { scheduledAfterDays: 45, recommendedMinDays: 21, recommendedMaxDays: 45,
  readyMinDays: 8, readyMaxDays: 20, urgentMinDays: 4, urgentMaxDays: 7,
  humanReviewMinDays: 0, humanReviewMaxDays: 3, dueSoonDays: 14, alertUrgentDays: 7, dueTodayDays: 0 as const };

describe("operational submission policy governance", () => {
  it("requires governed transitions, permissions, concurrency and audit history", () => {
    const repository = new InMemoryOperationalSubmissionPolicyRepository();
    const policy = createOperationalSubmissionPolicy({ policyId: "policy-v1", version: 1,
      effectiveFrom: "2026-08-27T00:00:00.000Z", sourceReference: "OWNER_APPROVED_V1_POLICY", thresholds });
    repository.addDraft(policy, actor(["rule.propose"]), new Date("2026-08-27T00:00:00Z"));
    const review = repository.transition({ policyId: policy.policyId, expectedVersion: 1, toState: "REVIEW", reason: "READY_FOR_REVIEW", occurredAt: new Date() }, actor(["rule.propose"]));
    const approved = repository.transition({ policyId: policy.policyId, expectedVersion: review.recordVersion, toState: "APPROVED", reason: "OWNER_POLICY_APPROVED", occurredAt: new Date() }, actor(["rule.review"]));
    const active = repository.transition({ policyId: policy.policyId, expectedVersion: approved.recordVersion, toState: "ACTIVE", reason: "SCOPED_ACTIVATION", occurredAt: new Date() }, actor(["rule.activate"]));
    expect(repository.active(new Date("2026-08-28T00:00:00Z"))).toEqual(active);
    expect(repository.history(policy.policyId).map((event) => event.toState)).toEqual(["DRAFT", "REVIEW", "APPROVED", "ACTIVE"]);
    expect(() => repository.transition({ policyId: policy.policyId, expectedVersion: 1, toState: "SUPERSEDED", reason: "STALE", occurredAt: new Date() }, actor(["rule.activate"]))).toThrow("OPERATIONAL_POLICY_VERSION_CONFLICT");
  });

  it("rejects gaps, overlaps and an unauthorized Operations employee", () => {
    expect(() => createOperationalSubmissionPolicy({ version: 1, effectiveFrom: new Date().toISOString(),
      sourceReference: "INVALID", thresholds: { ...thresholds, readyMinDays: 9 } })).toThrow("INVALID_OPERATIONAL_SUBMISSION_POLICY");
    const repository = new InMemoryOperationalSubmissionPolicyRepository();
    const policy = createOperationalSubmissionPolicy({ version: 1, effectiveFrom: new Date().toISOString(), sourceReference: "OWNER", thresholds });
    expect(() => repository.addDraft(policy, actor([]), new Date())).toThrow("OPERATIONAL_POLICY_ACCESS_DENIED");
  });
});
