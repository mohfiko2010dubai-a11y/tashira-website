import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("migrations/036_operations_email_queue.sql", "utf8");
const rollback = readFileSync(
  "migrations/036_operations_email_queue.rollback.sql",
  "utf8"
);

describe("Operations email queue migration", () => {
  it("adds immutable provider-independent queue and delivery evidence", () => {
    for (const table of [
      "operations_email_dispatches",
      "operations_email_dispatch_events",
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS \`${table}\``);
      expect(rollback).toContain(`DROP TABLE IF EXISTS \`${table}\``);
    }
    for (const trigger of [
      "operations_email_dispatch_identity_guard",
      "operations_email_dispatch_no_update",
      "operations_email_dispatch_event_no_update",
    ])
      expect(sql).toContain(trigger);
    expect(sql).toContain("operations_email_dispatch_dedup_uq");
  });
  it("contains no recipient plaintext, provider credentials or automatic send", () => {
    const statements = sql.replace(/^--.*$/gm, "");
    expect(statements).not.toMatch(
      /recipient_email|api_key|credential|secret|resend|smtp|http|send_email/i
    );
    expect(statements).not.toMatch(
      /supplier_cost|internal_cost|margin|profit|payment_intent|stripe|storage_path/i
    );
  });
});
