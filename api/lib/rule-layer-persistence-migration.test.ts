import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const forward = new URL("../../migrations/022_rule_layer_persistence.sql", import.meta.url);
const rollback = new URL("../../migrations/022_rule_layer_persistence.rollback.sql", import.meta.url);

describe("Rule layer persistence migration", () => {
  it("uses the authoritative precedence enum without guessing a legacy default", async () => {
    const sql = await readFile(forward, "utf8");
    for (const layer of [
      "BASE_ROUTE", "NATIONALITY_OVERLAY", "RESIDENCE_OVERLAY", "GCC_OVERLAY",
      "AGE_MINOR_OVERLAY", "FAMILY_OVERLAY", "OPERATIONAL_OVERLAY",
    ]) expect(sql).toContain(`'${layer}'`);
    expect(sql).toContain("`rule_layer` enum(");
    expect(sql).toContain(") NULL AFTER `classification`");
    expect(sql).not.toMatch(/DEFAULT\s+'(?:BASE_ROUTE|NATIONALITY_OVERLAY|RESIDENCE_OVERLAY|GCC_OVERLAY|AGE_MINOR_OVERLAY|FAMILY_OVERLAY|OPERATIONAL_OVERLAY)'/i);
    expect(sql).not.toMatch(/^\s*UPDATE\b/im);
  });

  it("rejects missing new layers, mutation, and activation of unresolved legacy rules", async () => {
    const sql = await readFile(forward, "utf8");
    expect(sql).toContain("Rule layer is required for new Rule Versions");
    expect(sql).toContain("Rule layer evidence is immutable");
    expect(sql).toContain("Legacy Rule Version without a layer cannot be approved or activated");
  });

  it("provides a scoped rollback", async () => {
    const sql = await readFile(rollback, "utf8");
    expect(sql.match(/DROP TRIGGER IF EXISTS/g)).toHaveLength(2);
    expect(sql).toContain("DROP COLUMN `rule_layer`");
    expect(sql).not.toMatch(/DELETE\s+FROM|UPDATE\s+/i);
  });
});
