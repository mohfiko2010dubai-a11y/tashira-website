import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

export async function verifyVisaChangeMysql(db) {
  const refused = error => error.sqlState === '45000';
  await db.beginTransaction();
  try {
    const [[staff]] = await db.query('SELECT id FROM staff_users LIMIT 1');
    const quote = randomUUID(), decision = randomUUID();
    await db.query("UPDATE applications SET substitution_version=1,substitution_acknowledged_version=1,submitted_product='NEW',status='under_review' WHERE id=2");
    await db.execute("INSERT INTO visa_change_quotes(id,application_id,version,previous_product,replacement_product,old_total_minor,new_total_minor,difference_minor,currency,quote_json) VALUES(?,2,1,'OLD','NEW',18500,21500,3000,'USD','{}')", [quote]);
    await assert.rejects(db.execute("UPDATE visa_change_quotes SET new_total_minor=22000 WHERE id=?", [quote]), refused);
    await assert.rejects(db.query("UPDATE applications SET status='visa_processing' WHERE id=2"), refused);
    await db.execute("UPDATE visa_change_quotes SET state='ACCEPTED',accepted_at=NOW(3) WHERE id=?", [quote]);
    await assert.rejects(db.execute("UPDATE visa_change_quotes SET state='SETTLED' WHERE id=?", [quote]), refused);
    await assert.rejects(db.execute("INSERT INTO visa_change_decisions(id,application_id,quote_id,quote_version,kind,direction,amount_minor,currency,reason,requested_by) VALUES(?,2,?,1,'SETTLEMENT','TOP_UP',3000,'USD','Synthetic settlement',?)", [decision, quote, staff.id]));
    await db.execute("INSERT INTO visa_change_decisions(id,application_id,quote_id,quote_version,kind,direction,amount_minor,currency,stripe_reference,reason,requested_by) VALUES(?,2,?,1,'SETTLEMENT','TOP_UP',3000,'USD','pi_synthetic_ci','Synthetic settlement',?)", [decision, quote, staff.id]);
    await assert.rejects(db.execute("UPDATE visa_change_decisions SET state='APPROVED',decided_by=?,decided_at=NOW(3),decision_reason='Verified evidence' WHERE id=?", [staff.id, decision]), refused);
    await db.execute("UPDATE staff_users SET staff_role='admin',is_active='active' WHERE id=?", [staff.id]);
    await assert.rejects(db.execute("UPDATE visa_change_decisions SET state='APPROVED',decided_by=?,decided_at=NOW(3),decision_reason='' WHERE id=?", [staff.id, decision]), refused);
    await db.execute("UPDATE visa_change_decisions SET state='APPROVED',decided_by=?,decided_at=NOW(3),decision_reason='Verified evidence' WHERE id=?", [staff.id, decision]);
    await db.execute("UPDATE visa_change_quotes SET state='SETTLED' WHERE id=?", [quote]);
    await db.query("UPDATE applications SET status='visa_processing' WHERE id=2");
    await assert.rejects(db.execute('DELETE FROM visa_change_decisions WHERE id=?', [decision]), refused);
    await assert.rejects(db.execute('DELETE FROM visa_change_quotes WHERE id=?', [quote]), refused);
    const hash = value => createHash('sha256').update(value).digest('hex');
    const sent = async () => db.execute("INSERT INTO outbound_email_events(id,email_application_id,email_template,source_reference,recipient_hash,email_provider,email_status) VALUES(?,2,'PRODUCT_SUBSTITUTED',?,?,'synthetic','SENT')", [randomUUID(), hash('2:substitution:2:1'), 'a'.repeat(64)]);
    await sent();
    const [[inactive]] = await db.query('SELECT COUNT(*) n FROM customer_wait_events'); assert.equal(Number(inactive.n), 0);
    // A different event/template source proves activation without backfilling the first message.
    await db.query("UPDATE customer_wait_policy SET enabled_at='2020-01-01' WHERE singleton=1");
    await db.execute("INSERT INTO product_substitution_events(application_id,version,product,action,actor,reason) VALUES(2,1,'NEW','PAYMENT_LINK_ISSUED','staff:ci','https://buy.stripe.com/synthetic')");
    await db.execute("INSERT INTO product_substitution_events(application_id,version,product,action,actor,reason) VALUES(2,1,'NEW','PAYMENT_LINK_ISSUED','staff:ci','retry')");
    await db.execute("INSERT INTO product_substitution_events(application_id,version,product,action,actor,reason) VALUES(2,1,'NEW','SETTLED','staff:ci','verified')");
    const [waits] = await db.query("SELECT * FROM customer_wait_events WHERE reason='PAYMENT_LINK_ISSUED' ORDER BY event_kind");
    assert.equal(waits.length, 2); assert.deepEqual(waits.map(row => row.event_kind), ['PAUSE', 'RESUME']);
    await assert.rejects(db.execute("UPDATE customer_wait_events SET reason='DOCUMENTS_REQUESTED' WHERE id=?", [waits[0].id]), refused);
    await assert.rejects(db.execute('DELETE FROM customer_wait_events WHERE id=?', [waits[0].id]), refused);
    const refusedQuote = randomUUID(), outcome = randomUUID();
    await db.query("UPDATE applications SET status='under_review',substitution_version=2,substitution_acknowledged_version=NULL WHERE id=2");
    await db.execute("INSERT INTO visa_change_quotes(id,application_id,version,previous_product,replacement_product,old_total_minor,new_total_minor,difference_minor,currency,quote_json) VALUES(?,2,2,'OLD','NEW',18500,21500,3000,'USD','{}')", [refusedQuote]);
    await db.execute("INSERT INTO outbound_email_events(id,email_application_id,email_template,source_reference,recipient_hash,email_provider,email_status) VALUES(?,2,'PRODUCT_SUBSTITUTED',?,?,'synthetic','SENT')", [randomUUID(), hash('2:substitution:2:2'), 'a'.repeat(64)]);
    await db.execute("UPDATE visa_change_quotes SET state='REFUSED' WHERE id=?", [refusedQuote]);
    await assert.rejects(db.execute("UPDATE visa_change_quotes SET state='SETTLED' WHERE id=?", [refusedQuote]), refused);
    await assert.rejects(db.query("UPDATE applications SET status='visa_processing',submitted_product='OLD' WHERE id=2"), refused);
    await db.execute("INSERT INTO visa_change_decisions(id,application_id,quote_id,quote_version,kind,outcome,reason,written_insistence,risk_record,requested_by) VALUES(?,2,?,2,'REFUSAL_OUTCOME','ORIGINAL_AT_CUSTOMER_REQUEST','Synthetic written instruction','Customer explicitly insists','Eligibility risk explained',?)", [outcome, refusedQuote, staff.id]);
    await db.execute("UPDATE visa_change_decisions SET state='APPROVED',decided_by=?,decided_at=NOW(3),decision_reason='Written instruction verified' WHERE id=?", [staff.id, outcome]);
    await db.query("UPDATE applications SET status='visa_processing',submitted_product='OLD',substitution_acknowledged_version=2 WHERE id=2");
    await db.execute("INSERT INTO product_substitution_events(application_id,version,product,action,actor,reason) VALUES(2,2,'OLD','REFUSAL_RESOLVED','staff:ci','approved outcome')");
    const [[unchanged]] = await db.execute('SELECT state FROM visa_change_quotes WHERE id=?', [refusedQuote]); assert.equal(unchanged.state, 'REFUSED');
    const [refusalWait] = await db.execute('SELECT event_kind FROM customer_wait_events WHERE wait_key=? ORDER BY event_kind', [`quote:${refusedQuote}`]); assert.deepEqual(refusalWait.map(row => row.event_kind), ['PAUSE','RESUME']);
    const requestId = randomUUID();
    await db.execute("INSERT INTO document_lifecycle_events(id,document_event_application_id,document_event_document_id,document_lifecycle_event_type,document_version,document_event_actor_type,created_at) VALUES(?,2,1,'REPLACEMENT_REQUESTED',1,'STAFF','2026-01-01')", [requestId]);
    await db.execute("INSERT INTO outbound_email_events(id,email_application_id,email_template,source_reference,recipient_hash,email_provider,email_status) VALUES(?,2,'DOCUMENTS_REQUIRED',?,?,'synthetic','SENT')", [randomUUID(), hash(`2:document-event:${requestId}`), 'a'.repeat(64)]);
    await db.execute("INSERT INTO document_lifecycle_events(id,document_event_application_id,document_event_document_id,replaces_document_id,document_lifecycle_event_type,document_version,document_event_actor_type) VALUES(?,2,7,1,'REPLACED',2,'CUSTOMER')", [randomUUID()]);
    const [documentWait] = await db.execute('SELECT event_kind FROM customer_wait_events WHERE wait_key=? ORDER BY event_kind', [`document:${requestId}`]); assert.deepEqual(documentWait.map(row => row.event_kind), ['PAUSE','RESUME']);
    // Execute the actual production query, not a mock: catches physical-column drift.
    const source = readFileSync('api/lib/payment-email-record.ts', 'utf8');
    const sql = source.match(/execute<RowDataPacket\[\]>\(`([\s\S]*?)`, \[applicationId, paymentId\]\)/)?.[1];
    assert(sql); await db.execute(sql, [2, 999999]);
    console.log('Migration068 MySQL PASS: immutable quote/decision, reference required, agent rejected, named admin approval, filing guard, activation, idempotent payment wait, append-only timeline, real payment-email SQL.');
  } finally { await db.rollback(); }
}
