import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migration = new URL("../../../migrations/024_travel_party_submission_scheduler.sql", import.meta.url);

describe("travel party and submission scheduler migration", () => {
  it("is additive, ownership-scoped and preserves immutable evidence", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).not.toMatch(/^\s*(?:DELETE|TRUNCATE|ALTER\s+TABLE|DROP\s+TABLE)\b/im);
    expect(sql).not.toMatch(/ON DELETE CASCADE/i);
    expect(sql).toContain("travel_group_applicants");
    expect(sql).toContain("travel_document_applicant_links");
    expect(sql).toContain("submission_schedule_snapshots");
    expect(sql).toContain("submission_schedule_no_update");
    expect(sql).toContain("submission_schedule_no_delete");
    expect(sql).toContain("entry_validity_rule_version");
    expect(sql).toContain("stay_duration_rule_version");
    expect(sql).toContain("operational_submission_policy_version");
    expect(sql).toContain("source_evidence_references_json");
    expect(sql).toContain("travel_document_document_fk");
  });
});
