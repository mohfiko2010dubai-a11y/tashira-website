import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("optional requirement classification migration", () => {
  it("adds OPTIONAL without changing or activating stored requirements", async () => {
    const sql = await readFile(new URL("../../../migrations/039_optional_requirement_classification.sql", import.meta.url), "utf8");
    expect(sql).toContain("'CONDITIONAL','OPTIONAL','INTERNAL'");
    expect(sql).not.toMatch(/\b(?:UPDATE|INSERT|DELETE|TRUNCATE)\b/i);
    expect(sql).not.toMatch(/governance_state|review_status|status='ACTIVE'/i);
  });
});
