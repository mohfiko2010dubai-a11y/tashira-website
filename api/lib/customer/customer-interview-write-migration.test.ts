import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../migrations/028_customer_interview_write_contract.sql", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../../../migrations/028_customer_interview_write_contract.rollback.sql", import.meta.url), "utf8");

describe("customer interview write migration", () => {
  it("adds optimistic applicant versions and append-only/idempotent evidence", () => {
    expect(migration).toContain("`profile_version` int unsigned NOT NULL DEFAULT 1");
    expect(migration).toContain("'GUARDIAN','DEPENDENT'");
    expect(migration).toContain("customer_interview_profile_events");
    expect(migration).toContain("customer_profile_applicant_version_uq");
    expect(migration).toContain("customer_profile_application_idempotency_uq");
    expect(migration).toContain("`command_sha256` char(64) NOT NULL");
    expect(migration).toContain("customer_interview_command_events");
    expect(migration).toContain("customer_command_application_idempotency_uq");
    expect(migration).toContain("`evidence_json` json NOT NULL");
    expect(migration).toContain("Customer profile history is append-only");
    expect(migration).toContain("Customer interview command history is append-only");
  });

  it("provides an explicit reverse-order rollback", () => {
    expect(rollback.indexOf("customer_interview_command_events")).toBeLessThan(rollback.indexOf("customer_interview_profile_events"));
    expect(rollback).toContain("'SPOUSE','CHILD','PARENT','SIBLING','OTHER'");
    expect(rollback.trimEnd().endsWith("ALTER TABLE `applicants` DROP COLUMN `profile_version`;"))
      .toBe(true);
  });
});
