import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "../authorization/permissions";

const forward = readFileSync("migrations/043_operations_permission_catalog.sql", "utf8");
const rollback = readFileSync("migrations/043_operations_permission_catalog.rollback.sql", "utf8");

describe("Operations permission catalog migration", () => {
  it.each(["support.read", "support.reply", "rule.propose", "rule.activate", "role.manage", "authority.record_submission"])(
    "adds the missing canonical %s permission",
    (permission) => {
      expect(PERMISSIONS).toContain(permission);
      expect(forward).toContain(`('${permission}'`);
    },
  );

  it("is additive and preserves existing classifications", () => {
    expect(forward).toContain("INSERT IGNORE INTO `operations_permissions`");
    expect(forward).not.toMatch(/UPDATE\s+`?operations_permissions/i);
  });

  it("rolls back only unreferenced permission rows", () => {
    expect(rollback).toContain("LEFT JOIN `operations_role_permissions`");
    expect(rollback).toContain("rp.permission_id IS NULL");
  });
});

