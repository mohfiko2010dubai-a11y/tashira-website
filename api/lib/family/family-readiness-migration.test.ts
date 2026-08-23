import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const forward = new URL("../../../migrations/019_family_readiness_contract.sql", import.meta.url);
const rollback = new URL("../../../migrations/019_family_readiness_contract.rollback.sql", import.meta.url);

describe("family readiness migration contract", () => {
  it("is additive, restrictive, applicant-scoped and append-only", async () => {
    const sql = await readFile(forward, "utf8");
    expect(sql).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE|TRUNCATE)\b/im);
    expect(sql).not.toMatch(/ON\s+DELETE\s+CASCADE/i);
    expect(sql).toContain("family_relationship_events");
    expect(sql).toContain("applicant_requirement_instances");
    expect(sql).toContain("applicant_requirement_events");
    expect(sql).toContain("family_readiness_snapshots");
    expect(sql).toContain("`applicant_id` bigint unsigned NOT NULL");
    expect(sql.match(/append-only/g)?.length).toBe(8);
  });

  it("has an explicit reverse dependency rollback", async () => {
    const sql = await readFile(rollback, "utf8");
    expect(sql.indexOf("family_readiness_snapshots")).toBeLessThan(sql.lastIndexOf("family_relationship_events"));
    expect(sql.indexOf("applicant_requirement_events")).toBeLessThan(sql.indexOf("applicant_requirement_instances`"));
  });
});
