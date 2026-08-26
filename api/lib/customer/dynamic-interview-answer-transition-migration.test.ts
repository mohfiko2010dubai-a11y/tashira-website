import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../../migrations/030_dynamic_interview_answer_transitions.sql", import.meta.url), "utf8");
const rollback = readFileSync(new URL("../../../migrations/030_dynamic_interview_answer_transitions.rollback.sql", import.meta.url), "utf8");

describe("Dynamic Interview answer transition migration", () => {
  it("allows a historical answer to be selected again only through a different predecessor", () => {
    expect(migration).toContain("DROP INDEX `dynamic_answer_hash_uq`");
    expect(migration).toContain("ADD UNIQUE KEY `dynamic_answer_transition_uq`");
    expect(migration).toContain("`answer_sha256`,`supersedes_event_id`");
    expect(migration).toContain("ADD KEY `dynamic_answer_hash_lookup_idx`");
  });

  it("provides the reviewed structural rollback", () => {
    expect(rollback).toContain("DROP INDEX `dynamic_answer_transition_uq`");
    expect(rollback).toContain("ADD UNIQUE KEY `dynamic_answer_hash_uq`");
  });
});
