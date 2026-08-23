import type { EligibilityRule } from "../eligibility/eligibility-engine";
import type { RuleVersionStatus } from "./rule-governance";

export type RuleStatusEvent = {
  id: string;
  ruleId: string;
  version: number;
  status: RuleVersionStatus;
  reason: string;
  actorReference: string;
  occurredAt: string;
};

function ruleKey(ruleId: string, version: number): string {
  return `${ruleId}\u0000${version}`;
}

function cloneRule(rule: EligibilityRule): EligibilityRule {
  return structuredClone(rule);
}

export class InMemoryRuleRegistryRepository {
  readonly #rules = new Map<string, EligibilityRule>();
  readonly #events: RuleStatusEvent[] = [];

  appendVersion(rule: EligibilityRule): void {
    const key = ruleKey(rule.id, rule.version);
    if (this.#rules.has(key)) throw new Error("Rule version already exists");
    this.#rules.set(key, cloneRule(rule));
  }

  appendStatus(event: RuleStatusEvent): void {
    if (!this.#rules.has(ruleKey(event.ruleId, event.version))) throw new Error("Rule version does not exist");
    if (this.#events.some((existing) => existing.id === event.id)) throw new Error("Rule status event already exists");
    this.#events.push(structuredClone(event));
  }

  status(ruleId: string, version: number): RuleVersionStatus | null {
    return this.#events
      .filter((event) => event.ruleId === ruleId && event.version === version)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id))[0]
      ?.status ?? null;
  }

  activeForRoute(routeCode: string): EligibilityRule[] {
    return [...this.#rules.values()]
      .filter((rule) => rule.routeCode === routeCode && this.status(rule.id, rule.version) === "ACTIVE")
      .sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version)
      .map(cloneRule);
  }

  versions(ruleId: string): EligibilityRule[] {
    return [...this.#rules.values()]
      .filter((rule) => rule.id === ruleId)
      .sort((left, right) => left.version - right.version)
      .map(cloneRule);
  }
}
