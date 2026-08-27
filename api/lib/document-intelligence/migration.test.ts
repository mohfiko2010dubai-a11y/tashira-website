import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const forward = readFileSync("migrations/042_document_intelligence_governance.sql", "utf8");
const rollback = readFileSync("migrations/042_document_intelligence_governance.rollback.sql", "utf8");

describe("document intelligence governance migration", () => {
  it("models governed authority fields, passport profiles, provenance, cost and immutable selections", () => {
    for (const value of ["authority_application_field_requirements", "passport_profile_versions", "document_intelligence_governance_events",
      "document_intelligence_runs", "document_field_evidence", "applicant_field_selection_events", "preferred_sources_json",
      "profile_sha256", "processing_cost", "raw_value_reference", "evidence_integrity_sha256", "staging_test_only"]) {
      expect(forward).toContain(value);
    }
    for (const trigger of ["authority_field_requirement_no_update", "passport_profile_version_no_update",
      "document_intelligence_run_no_update", "document_field_evidence_no_update", "applicant_field_selection_no_update"]) {
      expect(forward).toContain(trigger);
    }
    expect(forward).not.toMatch(/\b(?:UPDATE|DELETE|TRUNCATE)\s+(?:TABLE\s+)?`?(?:applications|applicants|documents)\b/i);
  });

  it("blocks rollback once governance or evidence exists", () => {
    expect(rollback).toContain("document_intelligence_evidence_count = 0");
    expect(rollback).toContain("Rollback blocked: document intelligence evidence exists");
    expect(rollback.indexOf("EXECUTE document_intelligence_rollback_statement"))
      .toBeLessThan(rollback.indexOf("DROP TRIGGER IF EXISTS"));
  });
});
