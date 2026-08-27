import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const forward = readFileSync(new URL("../../../migrations/038_travel_date_change_evidence.sql", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../../../migrations/038_travel_date_change_evidence.rollback.sql", import.meta.url), "utf8");
describe("travel date change evidence migration", () => {
  it("binds immutable change evidence to both schedule snapshots and the owned group", () => {
    expect(forward).toContain("previous_schedule_evaluation_id"); expect(forward).toContain("new_schedule_evaluation_id");
    expect(forward).toContain("Travel date change evidence is append-only"); expect(forward).toContain("version_after");
    expect(forward).not.toMatch(/ON DELETE CASCADE|DROP TABLE|TRUNCATE/i);
  });
  it("has an isolated rollback", () => expect(rollback).toContain("DROP TABLE IF EXISTS `travel_date_change_events`"));
});
