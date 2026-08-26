import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migration = new URL("../../../migrations/026_requirement_catalog.sql", import.meta.url);
const rollback = new URL("../../../migrations/026_requirement_catalog.rollback.sql", import.meta.url);

describe("requirement catalog migration", () => {
  it("is additive, versioned, governed and preserves historical instance references", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).not.toMatch(/^\s*(?:DELETE|TRUNCATE)\b/im);
    expect(sql).not.toMatch(/ON DELETE CASCADE/i);
    expect(sql).toContain("requirement_definitions");
    expect(sql).toContain("requirement_question_definitions");
    expect(sql).toContain("requirement_definition_version");
    expect(sql).toContain("source_rule_version");
    expect(sql).toContain("reason_snapshot");
    expect(sql).toContain("requirement_definitions_no_update");
    expect(sql).toContain("requirement_questions_no_delete");
  });

  it("has an explicit isolated-environment rollback", async () => {
    const sql = await readFile(rollback, "utf8");
    expect(sql).toContain("DROP TABLE IF EXISTS `requirement_definitions`");
    expect(sql).toContain("DROP COLUMN `requirement_definition_id`");
  });
});
