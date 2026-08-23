import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const forward = new URL("../../../migrations/020_operations_controlled_write_persistence.sql", import.meta.url);
const rollback = new URL("../../../migrations/020_operations_controlled_write_persistence.rollback.sql", import.meta.url);

describe("controlled-write persistence migration", () => {
  it("is additive, legacy-safe and contains no finance mutation path", async () => {
    const sql = await readFile(forward, "utf8");
    expect(sql).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE|TRUNCATE)\b/im);
    expect(sql).not.toMatch(/ON\s+DELETE\s+CASCADE/i);
    expect(sql).not.toMatch(/supplier_cost|internal_cost|margin|price/i);
    expect(sql).not.toMatch(/^\s*INSERT\s+INTO\s+`applications`/im);
    expect(sql).toContain("require no backfill");
    expect(sql).toContain("operations_case_controls");
    expect(sql).toContain("operations_action_events");
    expect(sql).toContain("operations_idempotency_records");
  });

  it("uses restrictive ownership, version, evaluation and audit-compatible evidence", async () => {
    const sql = await readFile(forward, "utf8");
    expect(sql).toContain("entity_version_after` = `entity_version_before` + 1");
    expect(sql).toContain("previous_evaluation_id");
    expect(sql).toContain("new_evaluation_id");
    expect(sql).toContain("applicant_id");
    expect(sql).toContain("document_version");
    expect(sql.match(/signal sqlstate '45000'.*append-only/gi)?.length).toBe(4);
  });

  it("rolls back in reverse dependency order without touching legacy tables", async () => {
    const sql = await readFile(rollback, "utf8");
    expect(sql.indexOf("operations_idempotency_records")).toBeLessThan(sql.lastIndexOf("operations_action_events"));
    expect(sql.indexOf("operations_action_events")).toBeLessThan(sql.lastIndexOf("operations_case_controls"));
    expect(sql).not.toContain("DROP TABLE IF EXISTS `applications`");
    expect(sql).not.toContain("DROP TABLE IF EXISTS `documents`");
  });
});
