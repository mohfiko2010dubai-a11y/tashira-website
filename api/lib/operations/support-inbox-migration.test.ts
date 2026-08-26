import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const forward = new URL("../../../migrations/031_support_inbox_persistence.sql", import.meta.url);
const rollback = new URL("../../../migrations/031_support_inbox_persistence.rollback.sql", import.meta.url);

describe("Support Inbox persistence migration", () => {
  it("adds scoped, concurrent and append-only support evidence without activation or financial data", async () => {
    const sql = await readFile(forward, "utf8");
    for (const table of ["operations_support_threads", "operations_support_messages", "operations_support_internal_notes", "operations_support_command_events"]) expect(sql).toContain(table);
    expect(sql).toContain("support_command_thread_uq"); expect(sql).toContain("support_command_version_ck");
    expect(sql.match(/CREATE TRIGGER/g)).toHaveLength(6);
    expect(sql).not.toMatch(/^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/im);
    expect(sql).not.toMatch(/stripe|payment|price|supplier_cost|internal_cost|margin|profit|storage_path/i);
  });

  it("has an explicit rollback in reverse dependency order", async () => {
    const sql = await readFile(rollback, "utf8");
    expect(sql.match(/DROP TRIGGER IF EXISTS/g)).toHaveLength(6);
    expect(sql.match(/DROP TABLE IF EXISTS/g)).toHaveLength(4);
    expect(sql.indexOf("operations_support_command_events")).toBeLessThan(sql.indexOf("operations_support_threads"));
  });
});
