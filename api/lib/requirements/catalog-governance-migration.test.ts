import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
const migration = new URL("../../../migrations/027_catalog_governance_dynamic_interview.sql", import.meta.url);
describe("catalog governance and dynamic interview migration", () => {
  it("is additive and keeps submitted definitions plus answer history immutable", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).not.toMatch(/^\s*(?:DELETE|TRUNCATE|DROP\s+TABLE)\b/im);
    expect(sql).not.toMatch(/ON DELETE CASCADE/i);
    expect(sql).toContain("requirement_catalog_governance_events");
    expect(sql).toContain("dynamic_interview_answer_events");
    expect(sql).toContain("Submitted requirement definition content is immutable");
    expect(sql).toContain("dynamic_interview_answers_no_update");
    expect(sql).toContain("record_version");
  });
});
