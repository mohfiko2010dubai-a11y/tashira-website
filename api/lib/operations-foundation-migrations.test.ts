import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migration = (name: string) => new URL(`../../migrations/${name}`, import.meta.url);

describe("Operations OS foundation migrations", () => {
  it.each([
    "014_operations_rbac.sql",
    "015_operations_audit_flags.sql",
    "016_visa_rule_registry.sql",
  ])("keeps forward migration %s additive and non-destructive", async (name) => {
    const sql = await readFile(migration(name), "utf8");
    expect(sql).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|DATABASE)\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bON\s+DELETE\s+CASCADE\b/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS/i);
  });

  it("does not grant existing staff a role or scope during migration", async () => {
    const sql = await readFile(migration("014_operations_rbac.sql"), "utf8");
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(sql).toContain("operations_scope_shape_ck");
    expect(sql).toContain("ON DELETE RESTRICT");
  });

  it("defaults feature flags to disabled and protects audit history", async () => {
    const sql = await readFile(migration("015_operations_audit_flags.sql"), "utf8");
    expect(sql).toContain("DEFAULT 'NO'");
    expect(sql).toContain("operations_audit_no_update");
    expect(sql).toContain("operations_audit_no_delete");
  });

  it("defaults imported rule versions to DRAFT with source evidence", async () => {
    const sql = await readFile(migration("016_visa_rule_registry.sql"), "utf8");
    expect(sql).toContain("DEFAULT 'DRAFT'");
    expect(sql).toContain("source_snapshot_id");
    expect(sql).toContain("fingerprint_sha256");
    expect(sql).toContain("visa_rule_effective_interval_ck");
  });

  it.each([
    "014_operations_rbac.rollback.sql",
    "015_operations_audit_flags.rollback.sql",
    "016_visa_rule_registry.rollback.sql",
  ])("provides an explicit reviewed rollback script for %s", async (name) => {
    const sql = await readFile(migration(name), "utf8");
    expect(sql).toMatch(/DROP TABLE IF EXISTS/i);
  });
});

describe("Visa Rule Registry MySQL compatibility", () => {
  it("keeps complete source URLs while indexing a fixed-width digest", async () => {
    const sql = await readFile(migration("016_visa_rule_registry.sql"), "utf8");
    expect(sql).toContain("`source_url` varchar(1000) NOT NULL");
    expect(sql).toContain("`source_url_sha256` binary(32) GENERATED ALWAYS AS");
    expect(sql).toContain("UNIQUE KEY `visa_rule_source_url_uq` (`source_url_sha256`)");
    expect(sql).not.toContain("UNIQUE KEY `visa_rule_source_url_uq` (`source_url`)");
  });
});
