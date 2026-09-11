import type { EligibilityRule } from "../eligibility/eligibility-engine";

/** Owner-reviewed customer form excludes demo-only document overlays, never official rules. */
export function customerFormRules(rules: readonly EligibilityRule[]): readonly EligibilityRule[] {
  return rules.flatMap(rule => {
    if (!rule.id.startsWith("STAGING_TEST_ROUTE_")) return [rule];
    if (/_TICKETS$|_PK$|_EG$/.test(rule.id)) return [];
    if (rule.id.endsWith("_GCC")) return [{ ...rule, conditions: [{ field: "gccCountry", operator: "IN" as const, value: ["AE", "OM"] }] }];
    return [rule];
  });
}
