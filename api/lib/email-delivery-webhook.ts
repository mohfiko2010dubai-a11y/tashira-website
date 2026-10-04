import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { defaultOperationsPool } from './operations/mysql-query-client';

export async function recordEmailDelivery(eventId: string, raw: string) {
  const event: unknown = JSON.parse(raw);
  if (!event || typeof event !== 'object' || !('type' in event) || !('data' in event) || !event.data || typeof event.data !== 'object' || !('email_id' in event.data) || typeof event.data.email_id !== 'string') throw new Error('Invalid delivery event');
  const status = event.type === 'email.delivered' ? 'DELIVERED' : ['email.bounced','email.complained','email.failed'].includes(String(event.type)) ? 'BOUNCED' : null;
  if (!status) return;
  const connection = await defaultOperationsPool().getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute<RowDataPacket[]>('SELECT event_id FROM email_delivery_receipts WHERE event_id=?', [eventId]);
    if (existing.length) { await connection.commit(); return; }
    const [sent] = await connection.execute<RowDataPacket[]>("SELECT * FROM outbound_email_events WHERE email_provider_reference=? AND email_status='SENT' LIMIT 1", [event.data.email_id]);
    // Provider can beat our send transaction. Retry instead of losing delivery evidence.
    if (!sent[0]) throw new Error('Send evidence not available yet');
    await connection.execute('INSERT INTO email_delivery_receipts(event_id,provider_reference,event_type) VALUES(?,?,?)', [eventId, event.data.email_id, String(event.type)]);
    const source = sent[0];
    await connection.execute(`INSERT INTO outbound_email_events(id,email_application_id,email_template,source_reference,recipient_hash,email_provider,email_status,email_provider_reference,email_failure_category)
      VALUES(?,?,?,?,?,'resend',?,?,?)`, [randomUUID(), source.email_application_id, source.email_template, source.source_reference, source.recipient_hash, status, event.data.email_id, status === 'BOUNCED' ? String(event.type) : null]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (!(error instanceof Error && Reflect.get(error, 'code') === 'ER_DUP_ENTRY')) throw error;
  } finally { connection.release(); }
}
