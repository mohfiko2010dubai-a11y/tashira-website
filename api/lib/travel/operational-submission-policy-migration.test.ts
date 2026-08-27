import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const forward = readFileSync(new URL("../../../migrations/037_operational_submission_policy_governance.sql", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../../../migrations/037_operational_submission_policy_governance.rollback.sql", import.meta.url), "utf8");

describe("operational submission policy migration", () => {
  it("adds governed versioned policy and append-only audit evidence without seed activation", () => {
    expect(forward).toContain("operations_submission_policies");
    expect(forward).toContain("operations_submission_policy_events");
    expect(forward).toContain("RECOMMENDED_WINDOW");
    expect(forward).toContain("URGENT");
    expect(forward).toContain("events are append-only");
    expect(forward).not.toMatch(/INSERT INTO `operations_submission_policies`/i);
  });
  it("has an explicit isolated rollback", () => {
    expect(rollback).toContain("DROP TABLE IF EXISTS `operations_submission_policy_events`");
    expect(rollback).toContain("DROP TABLE IF EXISTS `operations_submission_policies`");
  });
});
