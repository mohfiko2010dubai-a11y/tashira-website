import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const forward = new URL("../../../migrations/023_operations_write_preconditions.sql", import.meta.url);
const rollback = new URL("../../../migrations/023_operations_write_preconditions.rollback.sql", import.meta.url);

describe("Operations write precondition persistence", () => {
  it("adds only explicit concurrency/capacity controls without backfill", async () => {
    const sql = await readFile(forward, "utf8");
    expect(sql).toContain("operations_document_controls");
    expect(sql).toContain("operations_staff_workload_limits");
    expect(sql).toContain("operations_action_team_fk");
    expect(sql).toContain("workload_limit_positive_ck");
    expect(sql).not.toMatch(/^\s*(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/im);
    expect(sql).not.toMatch(/supplier_cost|internal_cost|margin|profit|stripe/i);
  });

  it("rolls back only the two additive control tables", async () => {
    const sql = await readFile(rollback, "utf8");
    expect(sql.match(/DROP TABLE IF EXISTS/g)).toHaveLength(2);
    expect(sql).toContain("DROP COLUMN `team_id`");
  });
});
