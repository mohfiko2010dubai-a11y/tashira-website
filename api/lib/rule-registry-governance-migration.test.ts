import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const forward = new URL("../../migrations/021_rule_registry_governance.sql", import.meta.url);
const rollback = new URL("../../migrations/021_rule_registry_governance.rollback.sql", import.meta.url);

describe("Rule Registry governance migration", () => {
  it("adds guards without rewriting or activating existing rules", async () => {
    const sql = await readFile(forward, "utf8");
    expect(sql).not.toMatch(/^\s*(?:UPDATE|DELETE|INSERT|DROP\s+TABLE|ALTER\s+TABLE)\b/im);
    expect(sql).toContain("cannot be imported directly as ACTIVE");
    expect(sql).toContain("Approved rule review is required before activation");
    expect(sql).toContain("Rule version evidence is immutable");
    expect(sql.match(/append-only/g)?.length).toBe(4);
  });

  it("rolls back only the six introduced triggers", async () => {
    const sql = await readFile(rollback, "utf8");
    expect(sql.match(/DROP TRIGGER IF EXISTS/g)?.length).toBe(6);
    expect(sql).not.toMatch(/DROP\s+TABLE|DELETE\s+FROM|UPDATE\s+/i);
  });
});
