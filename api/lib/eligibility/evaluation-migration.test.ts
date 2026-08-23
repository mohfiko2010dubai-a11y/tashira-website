import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const forwardUrl = new URL("../../../migrations/017_eligibility_evidence.sql", import.meta.url);
const rollbackUrl = new URL("../../../migrations/017_eligibility_evidence.rollback.sql", import.meta.url);
const snapshotForwardUrl = new URL("../../../migrations/018_eligibility_snapshot_contract.sql", import.meta.url);
const snapshotRollbackUrl = new URL("../../../migrations/018_eligibility_snapshot_contract.rollback.sql", import.meta.url);

describe("eligibility evidence migration", () => {
  it("is additive, restrictive and append-only", async () => {
    const sql = await readFile(forwardUrl, "utf8");
    expect(sql).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|DATABASE)\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bON\s+DELETE\s+CASCADE\b/i);
    expect(sql).toContain("visa_rule_evaluation_runs");
    expect(sql).toContain("visa_rule_evaluation_matches");
    expect(sql).toContain("visa_rule_evaluation_conflicts");
    expect(sql).toContain("RULE_CONFLICT");
    expect(sql).toContain("evidence_sha256");
    expect(sql.match(/append-only/g)?.length).toBe(6);
  });

  it("has an explicit reverse-order rollback", async () => {
    const sql = await readFile(rollbackUrl, "utf8");
    expect(sql.indexOf("visa_rule_evaluation_conflicts")).toBeLessThan(sql.indexOf("visa_rule_evaluation_matches"));
    expect(sql.indexOf("visa_rule_evaluation_matches")).toBeLessThan(sql.indexOf("visa_rule_evaluation_runs"));
  });

  it("extends snapshots without rewriting evaluation history", async () => {
    const sql = await readFile(snapshotForwardUrl, "utf8");
    expect(sql).not.toMatch(/^\s*UPDATE\s+/im);
    expect(sql).not.toMatch(/^\s*DELETE\s+FROM\b/im);
    expect(sql).not.toMatch(/\bON\s+DELETE\s+CASCADE\b/i);
    expect(sql).toContain("reevaluation_reason");
    expect(sql).toContain("warnings_json");
    expect(sql).toContain("precedence_trace_json");
    expect(sql).toContain("visa_rule_evaluation_selections");
    expect(sql).toContain("selection history is append-only");
  });

  it("provides a reviewed snapshot-contract rollback", async () => {
    const sql = await readFile(snapshotRollbackUrl, "utf8");
    expect(sql).toContain("DROP TABLE IF EXISTS `visa_rule_evaluation_selections`");
    expect(sql).toContain("DROP COLUMN `reevaluation_reason`");
  });
});
