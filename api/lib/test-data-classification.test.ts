import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("production test-data classification", () => {
  it("adds a non-destructive LIVE/TEST classification with LIVE as the default", async () => {
    const migration = await readFile(
      new URL("../../migrations/009_application_data_classification.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("enum('LIVE','TEST') NOT NULL DEFAULT 'LIVE'");
    expect(migration).not.toMatch(/\bDELETE\b/i);
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bUPDATE\s+`?applications`?/i);
  });

  it("filters administrative lists and analytics to LIVE applications", async () => {
    const [applicationRouter, businessRouter] = await Promise.all([
      readFile(new URL("../application-router.ts", import.meta.url), "utf8"),
      readFile(new URL("../business-router.ts", import.meta.url), "utf8"),
    ]);
    expect(applicationRouter).toContain('eq(applications.dataClassification, "LIVE")');
    expect(applicationRouter).toContain("const livePaid = and(liveOnly");
    expect(businessRouter).toContain('eq(applications.dataClassification, "LIVE")');
    expect(businessRouter).toContain("innerJoin(applications, eq(payments.applicationId, applications.id))");
    expect(businessRouter).toContain("innerJoin(applications, eq(applicants.applicationId, applications.id))");
  });
});
