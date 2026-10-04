import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

/** Called only by the guarded disposable MySQL runner; all fixture writes roll back. */
export async function verifyPhase2Mysql(db) {
  await db.beginTransaction();
  try {
    const [[staff]] = await db.query('SELECT id,staff_role,mfa_secret,mfa_last_counter FROM staff_users LIMIT 1');
    assert(staff); assert.equal(staff.staff_role, 'staff'); assert.equal(staff.mfa_secret, null);
    const [[transition]] = await db.query('SELECT COUNT(*) total FROM staff_auth_transition');
    assert.equal(Number(transition.total), 0);
    const setupHash = randomUUID().replaceAll('-', '').padEnd(64, '0');
    await db.execute('INSERT INTO staff_setup_links(token_hash,staff_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))', [setupHash, staff.id]);
    const [consumed] = await db.execute('UPDATE staff_setup_links SET consumed_at=UTC_TIMESTAMP() WHERE token_hash=? AND consumed_at IS NULL', [setupHash]);
    const [reused] = await db.execute('UPDATE staff_setup_links SET consumed_at=UTC_TIMESTAMP() WHERE token_hash=? AND consumed_at IS NULL', [setupHash]);
    assert.equal(consumed.affectedRows, 1); assert.equal(reused.affectedRows, 0);
    await assert.rejects(db.execute('DELETE FROM staff_users WHERE id=?', [staff.id]), error => error.sqlState === '45000');
    const [insert] = await db.execute("INSERT INTO document_access_events(document_id,staff_id,action) VALUES(1,?,'VIEW')", [staff.id]);
    for (const statement of ['UPDATE document_access_events SET staff_id=999 WHERE id=?','DELETE FROM document_access_events WHERE id=?']) {
      await assert.rejects(db.execute(statement, [insert.insertId]), error => error.sqlState === '45000');
    }
    const reference = `synthetic-${randomUUID()}`, sentId = randomUUID();
    await db.execute(`INSERT INTO outbound_email_events(id,email_application_id,email_template,source_reference,recipient_hash,email_provider,email_status,email_provider_reference)
      VALUES(?,2,'DOCUMENTS_COMPLETE',?,?,'synthetic','SENT',?)`, [sentId, reference, 'a'.repeat(64), reference]);
    await db.execute(`INSERT INTO outbound_email_events(id,email_application_id,email_template,source_reference,recipient_hash,email_provider,email_status,email_provider_reference)
      VALUES(?,2,'DOCUMENTS_COMPLETE',?,?,'synthetic','BOUNCED',?)`, [randomUUID(), reference, 'a'.repeat(64), reference]);
    const [[flag]] = await db.query('SELECT email_delivery_issue FROM applications WHERE id=2'); assert.equal(flag.email_delivery_issue, 1);
    const [events] = await db.execute('SELECT event_name FROM application_timeline_events WHERE application_id=2 AND actor_reference=? ORDER BY event_name', [reference]);
    assert.deepEqual(events.map(e => e.event_name), ['EMAIL_BOUNCED','EMAIL_SENT']);
    await assert.rejects(db.execute(`INSERT INTO outbound_email_events(id,email_application_id,email_template,source_reference,recipient_hash,email_provider,email_status,email_provider_reference)
      VALUES(?,2,'DOCUMENTS_COMPLETE',?,?,'synthetic','SENT',?)`, [randomUUID(), reference, 'a'.repeat(64), reference]), error => error.code === 'ER_DUP_ENTRY');
    await db.execute('INSERT INTO email_delivery_receipts(event_id,provider_reference,event_type) VALUES(?,?,?)', [reference, reference, 'email.bounced']);
    await assert.rejects(db.execute('INSERT INTO email_delivery_receipts(event_id,provider_reference,event_type) VALUES(?,?,?)', [reference, reference, 'email.bounced']), error => error.code === 'ER_DUP_ENTRY');
    await assert.rejects(db.execute('DELETE FROM email_delivery_receipts WHERE event_id=?', [reference]), error => error.sqlState === '45000');
    await db.execute("INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json) VALUES(?,2,'DOCUMENTS_COMPLETE','{}')", [reference]);
    const [claimed] = await db.execute("UPDATE transactional_email_jobs SET job_status='SENDING',attempts=attempts+1 WHERE job_key=? AND job_status='PENDING'", [reference]);
    const [replay] = await db.execute("UPDATE transactional_email_jobs SET job_status='SENDING',attempts=attempts+1 WHERE job_key=? AND job_status='PENDING'", [reference]);
    assert.equal(claimed.affectedRows, 1); assert.equal(replay.affectedRows, 0);
    await db.execute("UPDATE transactional_email_jobs SET job_status='SUPPRESSED' WHERE job_key=?", [reference]);
    const [[suppressed]] = await db.execute('SELECT job_status FROM transactional_email_jobs WHERE job_key=?', [reference]);
    assert.equal(suppressed.job_status, 'SUPPRESSED');
    const [retryable] = await db.execute("SELECT job_key FROM transactional_email_jobs WHERE job_key=? AND job_status IN ('PENDING','FAILED')", [reference]);
    assert.equal(retryable.length, 0);
    console.log('Phase2 MySQL: named-role defaults, immutable access audit, send/bounce timeline, bounce flag, receipt/send deduplication and exclusive mail claim PASS.');
  } finally { await db.rollback(); }
}
