import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const forwardUrl = new URL("../../../migrations/017_eligibility_evidence.sql", import.meta.url);
const rollbackUrl = new URL("../../../migrations/017_eligibility_evidence.rollback.sql", import.meta.url);

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
});
