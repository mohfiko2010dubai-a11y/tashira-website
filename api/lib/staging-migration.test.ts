import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../../migrations/005_business_architecture.sql", import.meta.url);
const applicantSlotMigrationUrl = new URL("../../migrations/006_applicant_slot_uniqueness.sql", import.meta.url);
const applicantSlotRunnerUrl = new URL("../../staging/apply-applicant-slot-migration.mjs", import.meta.url);
const runnerUrl = new URL("../../staging/guarded-db-push.mjs", import.meta.url);

describe("staging migration 005 safety", () => {
  it("contains the required identity, integrity, and long-date controls", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bON\s+DELETE\s+CASCADE\b/i);
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS `pricing_rules`");
    expect(sql).toContain("application_price_snapshot_uq");
    expect(sql).toContain("retention_due_hold_idx");
    expect(sql).toContain("FOREIGN KEY (`payment_id`)");
    expect(sql).toContain("`scheduled_deletion_at` datetime");
    expect(sql).toContain("application_timeline_no_update");
    expect(sql).toContain("price_snapshot_no_delete");
  });

  it("refuses every database identity except the isolated staging database", async () => {
    const runner = await readFile(runnerUrl, "utf8");
    expect(runner).toContain('databaseName !== "tashira_staging"');
    expect(runner).toContain('databaseUser !== "tashira_staging_app"');
    expect(runner).toContain('identity.database_name !== "tashira_staging"');
    expect(runner).toContain("migrations/005_business_architecture.sql");
  });

  it("refuses to create applicant-slot uniqueness over unresolved duplicates", async () => {
    const sql = await readFile(applicantSlotMigrationUrl, "utf8");
    const runner = await readFile(applicantSlotRunnerUrl, "utf8");
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).toContain("HAVING COUNT(*) > 1");
    expect(sql).toContain("Duplicate applicant slots require reviewed resolution");
    expect(sql).toContain("applicant_application_index_uq");
    expect(runner).toContain('identity?.database_name !== "tashira_staging"');
    expect(runner).toContain('identity?.database_user !== "tashira_staging_app"');
  });
});
