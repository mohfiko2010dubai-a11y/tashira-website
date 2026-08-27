import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const forward = readFileSync("migrations/041_visa_rule_lifecycle_evidence.sql", "utf8");
const rollback = readFileSync("migrations/041_visa_rule_lifecycle_evidence.rollback.sql", "utf8");
describe("visa rule lifecycle evidence migration", () => {
  it("adds append-only version lifecycle evidence", () => {
    for (const value of ["visa_rule_governance_events", "rule_version_id", "from_status", "to_status", "actor_reference", "payload_sha256",
      "visa_rule_governance_event_no_update", "visa_rule_governance_event_no_delete"]) expect(forward).toContain(value);
    expect(forward).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE)\s+(?:TABLE\s+)?`?visa_rule_versions/i);
  });
  it("blocks rollback after evidence exists", () => {
    expect(rollback).toContain("visa_rule_event_count = 0");
    expect(rollback).toContain("Rollback blocked: visa rule governance evidence exists");
  });
});
