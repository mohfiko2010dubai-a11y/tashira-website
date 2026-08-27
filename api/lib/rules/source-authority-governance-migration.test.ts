import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const forward = readFileSync("migrations/040_rule_source_authority_governance.sql", "utf8");
const rollback = readFileSync("migrations/040_rule_source_authority_governance.rollback.sql", "utf8");

describe("rule source authority governance migration", () => {
  it("adds versioned append-only classification evidence without rewriting sources", () => {
    expect(forward).toContain("visa_rule_source_authority_events");
    expect(forward).toContain("policy_version");
    expect(forward).toContain("authority_type");
    expect(forward).toContain("actor_reference");
    expect(forward).toContain("visa_rule_source_authority_event_no_update");
    expect(forward).toContain("visa_rule_source_authority_event_no_delete");
    expect(forward).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE)\s+(?:TABLE\s+)?`?visa_rule_sources/i);
  });

  it("blocks destructive rollback after governance evidence exists", () => {
    expect(rollback).toContain("source_authority_event_count = 0");
    expect(rollback).toContain("Rollback blocked: source authority governance evidence exists");
  });
});
