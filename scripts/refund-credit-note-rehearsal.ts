import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import assert from "node:assert/strict";
import { parseMysqlClientScript, validateRehearsalTarget } from "../api/lib/operations/mysql-rehearsal-runner";

const raw = process.env.OPS_REHEARSAL_DATABASE_URL ?? "";
validateRehearsalTarget(raw);
process.env.DATABASE_URL = raw;
process.env.STRIPE_MODE = "TEST";
process.env.VITE_STRIPE_PUBLISHABLE_KEY = "pk_test_synthetic_ci";
process.env.STRIPE_SECRET_KEY = "sk_test_synthetic_ci";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_synthetic_ci";
globalThis.fetch = async () => { throw new Error("No HTTP is allowed in credit-note persistence"); };
const { completeVisaRefundWithCreditNote } = await import("../api/lib/refund-credit-note");
const { defaultOperationsPool } = await import("../api/lib/operations/mysql-query-client");
const db = await mysql.createConnection(raw);
try {
  await db.query("ALTER TABLE applications ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT TRUE");
  for (const statement of parseMysqlClientScript(readFileSync("migrations/058_financial_document_series.sql", "utf8"))) await db.query(statement);
  const caseId = randomUUID();
  await db.execute(`INSERT INTO refund_cases (id,application_id,refund_case_status,reason,policy_version,requested_by)
    VALUES (?,1,'PROCESSING','Synthetic refund','synthetic','synthetic')`, [caseId]);
  async function item() {
    const id = randomUUID();
    await db.execute(`INSERT INTO refund_items (id,refund_case_id,refund_source_type,payment_id,original_amount,requested_amount,
      refund_deduction_type,deduction_value,refund_amount,currency,refund_item_status,idempotency_key)
      VALUES (?,?,'VISA_SERVICE',1,272.48,30,'NONE',0,30,'USD','PROCESSING',?)`, [id, caseId, `refund-${randomUUID()}`]);
    return id;
  }
  const refund = { id: "re_synthetic_ci_one", payment_intent: "pi_synthetic_rehearsal", amount: 3000, currency: "usd", status: "succeeded" as const };
  const firstId = await item();
  assert.equal((await completeVisaRefundWithCreditNote(firstId, refund)).number, "TEST-CN-00001");
  assert.equal((await completeVisaRefundWithCreditNote(firstId, refund)).changed, false);
  const secondId = await item();
  await db.query("CREATE TRIGGER ci_refund_fault BEFORE UPDATE ON refund_items FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic accounting fault'");
  try {
    await assert.rejects(completeVisaRefundWithCreditNote(secondId, { ...refund, id: "re_synthetic_ci_two" }), /Synthetic accounting fault/);
  } finally { await db.query("DROP TRIGGER ci_refund_fault"); }
  const [before] = await db.query<mysql.RowDataPacket[]>("SELECT last_number FROM financial_document_counters WHERE series='TEST-CN'");
  assert.equal(Number(before[0].last_number), 1);
  assert.equal((await completeVisaRefundWithCreditNote(secondId, { ...refund, id: "re_synthetic_ci_two" })).number, "TEST-CN-00002");
  const [invoiceCounters] = await db.query<mysql.RowDataPacket[]>("SELECT * FROM financial_document_counters WHERE series IN ('TSH-INV','TEST-INV')");
  assert.equal(invoiceCounters.length, 0);
  const [archives] = await db.query<mysql.RowDataPacket[]>("SELECT pdf_bytes FROM financial_document_archives");
  assert.equal(archives.length, 2);
  assert(archives.every(row => Buffer.from(row.pdf_bytes).subarray(0, 4).toString() === "%PDF"));
  console.log(JSON.stringify({ creditNotes: 2, invoiceCounterUntouched: true, replay: true, rollbackWithoutGap: true, networkCalls: 0 }));
} finally { await db.end(); await defaultOperationsPool().end(); }
