import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("migrations/032_supplier_sla_escalation.sql", "utf8");
const rollback = readFileSync("migrations/032_supplier_sla_escalation.rollback.sql", "utf8");

describe("supplier SLA migration", () => {
  it("adds explicit versioned policy, immutable instance snapshot and append-only events", () => {
    for (const table of ["operations_supplier_sla_policies", "operations_supplier_sla_instances", "operations_supplier_sla_events"]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS \`${table}\``);
      expect(rollback).toContain(`DROP TABLE IF EXISTS \`${table}\``);
    }
    expect(sql).toContain("supplier_sla_policy_no_update");
    expect(sql).toContain("supplier_sla_instance_identity_immutable");
    expect(sql).toContain("supplier_sla_event_no_update");
    expect(sql).toContain("supplier_sla_event_idempotency_uq");
    expect(sql).toContain("version_after` = `version_before` + 1");
  });

  it("contains no finance, pricing, payment, Stripe or storage fields", () => {
    expect(sql).not.toMatch(/supplier_cost|internal_cost|margin|markup|profit|price|payment|stripe|payout|storage_path/i);
  });
});
