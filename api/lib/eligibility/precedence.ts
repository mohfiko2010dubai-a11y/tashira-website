export const RULE_PRECEDENCE = [
  "BASE_ROUTE",
  "NATIONALITY_OVERLAY",
  "RESIDENCE_OVERLAY",
  "GCC_OVERLAY",
  "AGE_MINOR_OVERLAY",
  "FAMILY_OVERLAY",
  "OPERATIONAL_OVERLAY",
] as const;

export type RuleLayer = typeof RULE_PRECEDENCE[number];

const precedenceIndex = new Map<RuleLayer, number>(RULE_PRECEDENCE.map((layer, index) => [layer, index]));

export function compareRuleLayers(left: RuleLayer, right: RuleLayer): number {
  return (precedenceIndex.get(left) ?? Number.MAX_SAFE_INTEGER)
    - (precedenceIndex.get(right) ?? Number.MAX_SAFE_INTEGER);
}
