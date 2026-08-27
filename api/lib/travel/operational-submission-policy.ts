import { createHash, randomUUID } from "node:crypto";
import type { AuthorizationActor } from "../authorization/policy";

export type OperationalPolicyState = "DRAFT" | "REVIEW" | "APPROVED" | "ACTIVE" | "REJECTED" | "SUPERSEDED";

export type SubmissionPolicyThresholds = {
  scheduledAfterDays: number;
  recommendedMinDays: number;
  recommendedMaxDays: number;
  readyMinDays: number;
  readyMaxDays: number;
  urgentMinDays: number;
  urgentMaxDays: number;
  humanReviewMinDays: number;
  humanReviewMaxDays: number;
  dueSoonDays: number;
  alertUrgentDays: number;
  dueTodayDays: 0;
};

export type OperationalSubmissionPolicy = {
  policyId: string;
  policyCode: "SUBMISSION_SCHEDULER";
  version: number;
  classification: "OPERATIONAL";
  state: OperationalPolicyState;
  recordVersion: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceReference: string;
  thresholds: SubmissionPolicyThresholds;
  evidenceSha256: string;
};

export type OperationalPolicyEvent = {
  eventId: string;
  policyId: string;
  fromState: OperationalPolicyState | null;
  toState: OperationalPolicyState;
  actorReference: string;
  reason: string;
  occurredAt: string;
  payloadSha256: string;
};

const transitions: Readonly<Record<OperationalPolicyState, readonly OperationalPolicyState[]>> = {
  DRAFT: ["REVIEW"], REVIEW: ["APPROVED", "REJECTED"], APPROVED: ["ACTIVE"],
  ACTIVE: ["SUPERSEDED"], REJECTED: ["DRAFT"], SUPERSEDED: [],
};

function hash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export function validateSubmissionPolicyThresholds(value: SubmissionPolicyThresholds): SubmissionPolicyThresholds {
  const integers = Object.values(value).every((threshold) => Number.isSafeInteger(threshold) && threshold >= 0);
  const contiguous = value.dueTodayDays === 0
    && value.humanReviewMinDays === 0 && value.humanReviewMaxDays === 3
    && value.urgentMinDays === value.humanReviewMaxDays + 1
    && value.readyMinDays === value.urgentMaxDays + 1
    && value.recommendedMinDays === value.readyMaxDays + 1
    && value.scheduledAfterDays === value.recommendedMaxDays
    && value.dueSoonDays > value.alertUrgentDays && value.alertUrgentDays > value.dueTodayDays;
  if (!integers || !contiguous) throw new Error("INVALID_OPERATIONAL_SUBMISSION_POLICY");
  return structuredClone(value);
}
export function createOperationalSubmissionPolicy(input: {
  policyId?: string; version: number; effectiveFrom: string; effectiveTo?: string | null;
  sourceReference: string; thresholds: SubmissionPolicyThresholds;
}): OperationalSubmissionPolicy {
  if (!Number.isSafeInteger(input.version) || input.version < 1 || !input.sourceReference.trim()) {
    throw new Error("INVALID_OPERATIONAL_SUBMISSION_POLICY");
  }
  const thresholds = validateSubmissionPolicyThresholds(input.thresholds);
  const identity = { policyId: input.policyId ?? randomUUID(), policyCode: "SUBMISSION_SCHEDULER" as const,
    version: input.version, classification: "OPERATIONAL" as const, effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null, sourceReference: input.sourceReference.trim(), thresholds };
  return { ...identity, state: "DRAFT", recordVersion: 1, evidenceSha256: hash(identity) };
}

function requirePermission(actor: AuthorizationActor, target: OperationalPolicyState): void {
  const permission = target === "REVIEW" || target === "DRAFT" ? "rule.propose"
    : target === "APPROVED" || target === "REJECTED" ? "rule.review" : "rule.activate";
  if (!actor.permissions.has(permission)) throw new Error("OPERATIONAL_POLICY_ACCESS_DENIED");
}

export class InMemoryOperationalSubmissionPolicyRepository {
  readonly #policies = new Map<string, OperationalSubmissionPolicy>();
  readonly #events: OperationalPolicyEvent[] = [];

  addDraft(policy: OperationalSubmissionPolicy, actor: AuthorizationActor, occurredAt: Date): OperationalSubmissionPolicy {
    requirePermission(actor, "DRAFT");
    if (policy.state !== "DRAFT" || this.#policies.has(policy.policyId)) throw new Error("OPERATIONAL_POLICY_VERSION_EXISTS");
    if ([...this.#policies.values()].some((item) => item.policyCode === policy.policyCode && item.version === policy.version)) {
      throw new Error("OPERATIONAL_POLICY_VERSION_EXISTS");
    }
    this.#policies.set(policy.policyId, structuredClone(policy));
    this.#events.push({ eventId: randomUUID(), policyId: policy.policyId, fromState: null, toState: "DRAFT",
      actorReference: actor.id, reason: "POLICY_DRAFT_CREATED", occurredAt: occurredAt.toISOString(), payloadSha256: policy.evidenceSha256 });
    return structuredClone(policy);
  }

  transition(input: { policyId: string; expectedVersion: number; toState: OperationalPolicyState; reason: string; occurredAt: Date }, actor: AuthorizationActor): OperationalSubmissionPolicy {
    const current = this.#policies.get(input.policyId);
    if (!current) throw new Error("OPERATIONAL_POLICY_NOT_FOUND");
    if (current.recordVersion !== input.expectedVersion) throw new Error("OPERATIONAL_POLICY_VERSION_CONFLICT");
    if (!transitions[current.state].includes(input.toState)) throw new Error("OPERATIONAL_POLICY_TRANSITION_INVALID");
    if (!input.reason.trim()) throw new Error("OPERATIONAL_POLICY_REASON_REQUIRED");
    requirePermission(actor, input.toState);
    if (input.toState === "ACTIVE" && [...this.#policies.values()].some((policy) => policy.policyId !== current.policyId
      && policy.policyCode === current.policyCode && policy.state === "ACTIVE")) throw new Error("OPERATIONAL_POLICY_ACTIVE_CONFLICT");
    const next = { ...current, state: input.toState, recordVersion: current.recordVersion + 1 };
    this.#policies.set(current.policyId, next);
    this.#events.push({ eventId: randomUUID(), policyId: current.policyId, fromState: current.state, toState: input.toState,
      actorReference: actor.id, reason: input.reason.trim(), occurredAt: input.occurredAt.toISOString(), payloadSha256: current.evidenceSha256 });
    return structuredClone(next);
  }

  active(at: Date): OperationalSubmissionPolicy | null {
    const timestamp = at.toISOString();
    const matches = [...this.#policies.values()].filter((policy) => policy.state === "ACTIVE" && policy.effectiveFrom <= timestamp
      && (policy.effectiveTo === null || policy.effectiveTo > timestamp));
    if (matches.length > 1) throw new Error("OPERATIONAL_POLICY_ACTIVE_CONFLICT");
    return matches[0] ? structuredClone(matches[0]) : null;
  }

  history(policyId: string): readonly OperationalPolicyEvent[] {
    return this.#events.filter((event) => event.policyId === policyId).map((event) => structuredClone(event));
  }
}
