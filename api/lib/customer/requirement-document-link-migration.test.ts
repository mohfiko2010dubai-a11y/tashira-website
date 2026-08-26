import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../migrations/029_customer_requirement_document_links.sql", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../../../migrations/029_customer_requirement_document_links.rollback.sql", import.meta.url), "utf8");

describe("customer requirement document link migration", () => {
  it("links one owned document to immutable current requirement evidence", () => {
    expect(migration).toContain("applicant_requirement_document_links");
    expect(migration).toContain("LINK_REQUIREMENT_DOCUMENT");
    expect(migration).toContain("requirement_document_instance_document_uq");
    expect(migration).toContain("`evidence_sha256` char(64) NOT NULL");
    expect(migration).toContain("Requirement document links are append-only");
    expect(migration).toContain("ON DELETE RESTRICT");
    expect(migration).not.toMatch(/ON DELETE CASCADE|DROP COLUMN|TRUNCATE/i);
  });

  it("provides an explicit reverse-order disposable-environment rollback", () => {
    expect(rollback.indexOf("requirement_document_links_no_delete")).toBeLessThan(rollback.indexOf("applicant_requirement_document_links"));
    expect(rollback.indexOf("applicant_requirement_document_links")).toBeLessThan(rollback.indexOf("ALTER TABLE"));
    expect(rollback).not.toMatch(/DELETE FROM|TRUNCATE/i);
  });
});
