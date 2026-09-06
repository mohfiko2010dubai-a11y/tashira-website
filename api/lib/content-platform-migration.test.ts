import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../../migrations/045_content_platform.sql", import.meta.url);
const rollbackUrl = new URL("../../migrations/045_content_platform.rollback.sql", import.meta.url);

describe("content platform migration 045", () => {
  it("is additive and non-destructive", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|DATABASE)\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(sql).not.toMatch(/\bON\s+DELETE\s+CASCADE\b/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS `content_items`/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS `content_versions`/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS `content_redirects`/i);
  });

  it("enforces per-locale slug and canonical uniqueness", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toMatch(/UNIQUE.*language.*slug|content_items_locale_slug_uniq/i);
    expect(sql).toMatch(/content_items_canonical_uniq/i);
  });

  it("keeps version snapshots immutable (restrict delete, no update triggers needed on insert-only table)", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toMatch(/ON DELETE RESTRICT/i);
  });

  it("seeds content.* permissions idempotently", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    expect(sql).toMatch(/INSERT IGNORE INTO `operations_permissions`/i);
    for (const perm of ["content.view", "content.create", "content.edit", "content.review", "content.publish", "content.unpublish", "content.archive", "content.manage_seo", "content.manage_redirects", "content.manage_media"]) {
      expect(sql).toContain(perm);
    }
  });

  it("provides a rollback that only drops the new tables", async () => {
    const sql = await readFile(rollbackUrl, "utf8");
    expect(sql).toMatch(/DROP TABLE IF EXISTS `content_versions`/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS `content_items`/i);
    expect(sql).toMatch(/DROP TABLE IF EXISTS `content_redirects`/i);
    expect(sql).not.toMatch(/applications|payments|invoices/i);
  });
});
