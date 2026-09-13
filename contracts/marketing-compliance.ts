import rules from "./marketing-compliance-rules.json";

export interface MarketingViolation {
  phrase: string;
  index: number;
  line: number;
  pattern: string;
}

/** A disclaimer exempts only an overlapping match, never the whole field. */
export function findMarketingViolations(text: string): MarketingViolation[] {
  const allowed = rules.allow.flatMap(pattern => Array.from(text.matchAll(new RegExp(pattern, "giu")), match => ({
    start: match.index,
    end: match.index + match[0].length,
  })));
  return rules.deny.flatMap(pattern => Array.from(text.matchAll(new RegExp(pattern, "giu"))).flatMap(match => {
    const start = match.index;
    const end = start + match[0].length;
    if (allowed.some(span => span.start < end && span.end > start)) return [];
    return [{ phrase: match[0], index: start, line: text.slice(0, start).split("\n").length, pattern }];
  })).sort((a, b) => a.index - b.index);
}
