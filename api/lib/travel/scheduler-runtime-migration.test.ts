import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migration = new URL("../../../migrations/025_scheduler_alert_communication_events.sql", import.meta.url);

describe("scheduler runtime event migration", () => {
  it("is additive, idempotent and append-only", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).not.toMatch(/^\s*(?:DELETE|TRUNCATE|ALTER\s+TABLE|DROP\s+TABLE)\b/im);
    expect(sql).not.toMatch(/ON DELETE CASCADE/i);
    expect(sql).toContain("scheduler_alert_version_uq");
    expect(sql).toContain("scheduler_communication_idempotency_uq");
    expect(sql).toContain("scheduler_alert_events_no_update");
    expect(sql).toContain("scheduler_communication_no_delete");
    expect(sql).toContain("schedule_evaluation_id");
    expect(sql).toContain("customer_contract_json");
  });
});
