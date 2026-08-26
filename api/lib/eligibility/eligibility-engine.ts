import { compareRuleLayers, RULE_PRECEDENCE, type RuleLayer } from "./precedence";

export type EligibilityState = "ELIGIBLE" | "INELIGIBLE" | "HUMAN_REVIEW_REQUIRED" | "RULE_CONFLICT";
export type RuleEligibilityEffect = "NO_CHANGE" | "ELIGIBLE" | "INELIGIBLE" | "HUMAN_REVIEW_REQUIRED";
export type RuleClassification = "OFFICIAL" | "OPERATIONAL" | "CONDITIONAL" | "INTERNAL";
export type ConditionOperator = "EQUALS" | "IN" | "NOT_IN" | "EXISTS";
export type ProfileValue = string | number | boolean | readonly string[] | undefined;

export type EligibilityProfile = {
  routeCode: string;
  attributes: Readonly<Record<string, ProfileValue>>;
};

export type EligibilityCondition = {
  field: string;
  operator: ConditionOperator;
  value?: string | readonly string[];
};

export type ConditionalDocument = {
  code: string;
  reason: string;
  when?: {
    questionCode: string;
    operator: "EQUALS" | "IN";
    value: string | readonly string[];
  };
};

export type EligibilityRule = {
  id: string;
  version: number;
  routeCode: string;
  layer: RuleLayer;
  classification: RuleClassification;
  sourceAuthority: string;
  reason: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  conditions: readonly EligibilityCondition[];
  eligibilityEffect: RuleEligibilityEffect;
  requiredDocuments: readonly string[];
  conditionalDocuments: readonly ConditionalDocument[];
};

export type MatchedRuleEvidence = {
  ruleId: string;
  ruleVersion: number;
  layer: RuleLayer;
  classification: RuleClassification;
  sourceAuthority: string;
  reason: string;
};

export type EligibilityEvaluationResult = {
  matchedRuleIds: readonly string[];
  matchedRuleVersions: readonly { ruleId: string; version: number }[];
  sourceAuthorities: readonly string[];
  matchedRules: readonly MatchedRuleEvidence[];
  reason: string;
  finalEligibilityState: EligibilityState;
  requiredDocuments: readonly string[];
  conditionalDocuments: readonly ConditionalDocument[];
  manualReviewReason: string | null;
};

function isEligibilityDecision(
  effect: RuleEligibilityEffect,
): effect is Exclude<RuleEligibilityEffect, "NO_CHANGE"> {
  return effect !== "NO_CHANGE";
}

function scalarEquals(actual: ProfileValue, expected: string): boolean {
  if (Array.isArray(actual)) return actual.map(String).includes(expected);
  return actual !== undefined && String(actual) === expected;
}

function matchesCondition(profile: EligibilityProfile, condition: EligibilityCondition): boolean {
  const actual = profile.attributes[condition.field];
  const expected = Array.isArray(condition.value) ? condition.value : condition.value === undefined ? [] : [condition.value];
  switch (condition.operator) {
    case "EXISTS": return actual !== undefined && actual !== "";
    case "EQUALS": return expected.length === 1 && scalarEquals(actual, expected[0]);
    case "IN": return expected.some((value) => scalarEquals(actual, value));
    case "NOT_IN": return !expected.some((value) => scalarEquals(actual, value));
  }
}

function matchesRule(profile: EligibilityProfile, rule: EligibilityRule, evaluatedAt: Date): boolean {
  return rule.routeCode === profile.routeCode
    && evaluatedAt >= rule.effectiveFrom
    && (rule.effectiveTo === null || evaluatedAt <= rule.effectiveTo)
    && rule.conditions.every((condition) => matchesCondition(profile, condition));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function conflictResult(matched: readonly EligibilityRule[], reason: string): EligibilityEvaluationResult {
  return buildResult(matched, "RULE_CONFLICT", reason, reason);
}

function buildResult(
  matched: readonly EligibilityRule[],
  state: EligibilityState,
  reason: string,
  manualReviewReason: string | null,
): EligibilityEvaluationResult {
  const ordered = [...matched].sort((left, right) =>
    compareRuleLayers(left.layer, right.layer)
      || left.id.localeCompare(right.id)
      || left.version - right.version);
  return {
    matchedRuleIds: ordered.map((rule) => rule.id),
    matchedRuleVersions: ordered.map((rule) => ({ ruleId: rule.id, version: rule.version })),
    sourceAuthorities: uniqueSorted(ordered.map((rule) => rule.sourceAuthority)),
    matchedRules: ordered.map((rule) => ({
      ruleId: rule.id,
      ruleVersion: rule.version,
      layer: rule.layer,
      classification: rule.classification,
      sourceAuthority: rule.sourceAuthority,
      reason: rule.reason,
    })),
    reason,
    finalEligibilityState: state,
    requiredDocuments: uniqueSorted(ordered.flatMap((rule) => rule.requiredDocuments)),
    conditionalDocuments: [...new Map(ordered
      .flatMap((rule) => rule.conditionalDocuments)
      .map((document) => [`${document.code}\u0000${document.reason}\u0000${JSON.stringify(document.when ?? null)}`, document])).values()]
      .sort((left, right) => left.code.localeCompare(right.code) || left.reason.localeCompare(right.reason)),
    manualReviewReason,
  };
}

export function evaluateEligibility(input: {
  profile: EligibilityProfile;
  rules: readonly EligibilityRule[];
  evaluatedAt: Date;
}): EligibilityEvaluationResult {
  const matched = input.rules
    .filter((rule) => matchesRule(input.profile, rule, input.evaluatedAt))
    .sort((left, right) => compareRuleLayers(left.layer, right.layer)
      || left.id.localeCompare(right.id)
      || left.version - right.version);
  const baseRules = matched.filter((rule) => rule.layer === "BASE_ROUTE");
  if (baseRules.length === 0) {
    return buildResult(matched, "HUMAN_REVIEW_REQUIRED", "No researched base route rule matched", "UNRESOLVED_PROFILE");
  }

  const invalidEligibilityRule = matched.find((rule) =>
    rule.classification !== "OFFICIAL" && rule.eligibilityEffect !== "NO_CHANGE");
  if (invalidEligibilityRule) {
    return conflictResult(matched, `NON_OFFICIAL_ELIGIBILITY_OVERRIDE:${invalidEligibilityRule.id}`);
  }

  const activeRuleVersions = new Map<string, Set<number>>();
  for (const rule of matched) {
    const versions = activeRuleVersions.get(rule.id) ?? new Set<number>();
    versions.add(rule.version);
    activeRuleVersions.set(rule.id, versions);
  }
  const overlappingVersion = [...activeRuleVersions.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .find(([, versions]) => versions.size > 1);
  if (overlappingVersion) {
    return conflictResult(matched, `OVERLAPPING_RULE_VERSIONS:${overlappingVersion[0]}`);
  }

  for (const layer of RULE_PRECEDENCE) {
    const authoritativeEffects = matched
      .filter((rule) => rule.layer === layer && rule.classification === "OFFICIAL")
      .map((rule) => rule.eligibilityEffect)
      .filter((effect) => effect !== "NO_CHANGE");
    if (new Set(authoritativeEffects).size > 1) {
      return conflictResult(matched, `AUTHORITATIVE_RULE_CONFLICT:${layer}`);
    }
  }

  let state: Exclude<EligibilityState, "RULE_CONFLICT"> | null = null;
  let decidingRule: EligibilityRule | null = null;
  for (const layer of RULE_PRECEDENCE) {
    const layerDecision = matched.find((rule) =>
      rule.layer === layer
      && rule.classification === "OFFICIAL"
      && rule.eligibilityEffect !== "NO_CHANGE");
    const layerEffect = layerDecision?.eligibilityEffect;
    if (layerDecision && layerEffect && isEligibilityDecision(layerEffect)) {
      state = layerEffect;
      decidingRule = layerDecision;
    }
  }

  if (!state || !decidingRule) {
    return buildResult(matched, "HUMAN_REVIEW_REQUIRED", "Matched rules contain no authoritative eligibility decision", "NO_AUTHORITATIVE_DECISION");
  }
  const manualReason = state === "HUMAN_REVIEW_REQUIRED" ? decidingRule.reason : null;
  return buildResult(matched, state, decidingRule.reason, manualReason);
}
