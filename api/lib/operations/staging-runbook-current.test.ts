import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Operations Staging runbook release alignment", () => {
  const source = readFileSync(resolve(process.cwd(), "docs/VISA_OPERATIONS_OS_STAGING_RUNBOOK.md"), "utf8");

  it("requires the full current migration chain and release manifest gate", () => {
    expect(source).toContain("migrations/014_operations_rbac.sql");
    expect(source).toContain("migrations/042_document_intelligence_governance.sql");
    expect(source).toContain("verify-operations-production-readiness.ts");
    expect(source).toContain("never blindly reapply historical migrations");
  });

  it.each(["TYPING_PACK", "AUTHORITY_QUERY", "VISA_DELIVERY", "REGULATORY_WATCHER", "OPERATIONS_EMAIL_AUTOMATION", "DOCUMENT_INTELLIGENCE"])("keeps %s in the explicit closed-flag inventory", (flag) => expect(source).toContain(`\`${flag}\``));
});
