import { randomUUID } from 'node:crypto';
import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { enqueueApplicationStatusEmail } from './lib/application-status-outbox';
import { recoverTransactionalEmailClaims } from './lib/transactional-email-worker';

const url = process.env.OPS_EXECUTOR_DATABASE_URL;
const suite = url ? describe.sequential : describe.skip;
suite('transactional status mail intent and bounded recovery', () => {
  let pool: Pool, applicationId: number;
  beforeAll(async () => {
    const target = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !target.pathname.startsWith('/tashira_ops_rehearsal_')) throw new Error('Synthetic rehearsal database required');
    pool = createPool({ uri: url, connectionLimit: 3 });
    const [app] = await pool.execute<ResultSetHeader>(`INSERT INTO applications
      (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status,data_classification,is_test,preferred_language)
      VALUES (?,'single','non-gcc','ROUTE_TEST','regular','status@example.invalid','000',1,100,'under_review','paid','TEST',1,'ar')`, [`MAIL-${randomUUID()}`]);
    applicationId = app.insertId;
  });
  afterAll(async () => { await pool?.end(); });
  it('rolls back status, timeline and mail together; successful commit keeps one canonical event', async () => {
    const connection = await pool.getConnection(), eventId = randomUUID();
    const input = { applicationId, from: 'under_review', to: 'documents_received', eventId, actor: 'SYNTHETIC', actorType: 'ADMIN' as const };
    try {
      await connection.beginTransaction();
      await connection.execute("UPDATE applications SET status='documents_received' WHERE id=?", [applicationId]);
      await enqueueApplicationStatusEmail(connection, input);
      await connection.rollback();
      const [empty] = await connection.execute<RowDataPacket[]>('SELECT COUNT(*) n FROM transactional_email_jobs WHERE application_id=?', [applicationId]);
      expect(Number(empty[0].n)).toBe(0);
      await connection.beginTransaction();
      await connection.execute("UPDATE applications SET status='documents_received' WHERE id=?", [applicationId]);
      await enqueueApplicationStatusEmail(connection, input);
      await enqueueApplicationStatusEmail(connection, { ...input, from: 'documents_received', eventId: randomUUID() });
      await connection.commit();
      const [rows] = await connection.execute<RowDataPacket[]>(`SELECT j.job_key,j.template,e.event_source,e.actor_type FROM transactional_email_jobs j
        JOIN application_timeline_events e ON j.job_key=CONCAT('application-status:',e.id) WHERE j.application_id=?`, [applicationId]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ job_key: `application-status:${eventId}`, template: 'STATUS_CHANGED', event_source: 'STATUS_OUTBOX', actor_type: 'ADMIN' });
    } finally { await connection.rollback(); connection.release(); }
  });
  it('holds ambiguous expired deliveries, recovers recent crashes, and preserves unattempted and sent jobs', async () => {
    const prefix = randomUUID();
    for (const [label, state, attempts, age] of [['expired', 'SENDING', 1, 25], ['failed', 'FAILED', 2, 25], ['fresh', 'SENDING', 1, 1], ['unattempted', 'PENDING', 0, 25], ['sent', 'SENT', 1, 25]] as const) {
      await pool.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json,job_status,attempts,created_at,claimed_at)
        VALUES (?,?,'STATUS_CHANGED','{}',?,?,DATE_SUB(NOW(),INTERVAL ? HOUR),DATE_SUB(NOW(),INTERVAL 20 MINUTE))`, [`${prefix}:${label}`, applicationId, state, attempts, age]);
    }
    await recoverTransactionalEmailClaims(pool);
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT job_key,job_status,attempts,failure_message FROM transactional_email_jobs WHERE job_key LIKE ?', [`${prefix}:%`]);
    const row = (label: string) => rows.find(item => item.job_key === `${prefix}:${label}`)!;
    for (const label of ['expired', 'failed']) {
      expect(row(label)).toMatchObject({ job_status: 'FAILED', attempts: 6 });
      expect(row(label).failure_message).toContain('Check the mail provider');
    }
    expect(row('fresh').job_status).toBe('PENDING');
    expect(row('unattempted')).toMatchObject({ job_status: 'PENDING', attempts: 0 });
    expect(row('sent').job_status).toBe('SENT');
  });
});
