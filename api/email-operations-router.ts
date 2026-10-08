import { z } from 'zod';
import type { RowDataPacket } from 'mysql2/promise';
import { adminQuery, createRouter, staffOrAdminQuery } from './middleware';
import { defaultOperationsPool } from './lib/operations/mysql-query-client';
import { isAdminEmail } from './lib/email-audience';

export const emailOperationsRouter = createRouter({
  history: staffOrAdminQuery.input(z.object({ referenceNumber: z.string().trim().min(3).max(100) }).strict()).query(async ({ input }) => {
    // scopedProcedure verifies current case ownership before this query. Return
    // delivery evidence only, never message bodies, tokens or provider payloads.
    const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(`SELECT e.id,e.email_template AS template,
      e.email_status AS status,e.created_at AS createdAt
      FROM outbound_email_events e JOIN applications a ON a.id=e.email_application_id
      WHERE a.reference_number=? ORDER BY e.created_at DESC,e.id DESC LIMIT 100`, [input.referenceNumber]);
    return rows.filter(row => !isAdminEmail(String(row.template))).map(row => ({
      id: String(row.id), template: String(row.template), status: String(row.status), createdAt: new Date(row.createdAt).toISOString(),
    }));
  }),
  failures: adminQuery.query(async () => {
    const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(`SELECT j.job_key,j.application_id,a.reference_number,j.template,j.attempts,j.failure_message,j.created_at
      FROM transactional_email_jobs j JOIN applications a ON a.id=j.application_id WHERE j.job_status='FAILED' ORDER BY j.created_at LIMIT 100`);
    return rows.map(row => ({ key: String(row.job_key), applicationId: Number(row.application_id), reference: String(row.reference_number), template: String(row.template), attempts: Number(row.attempts), error: String(row.failure_message || 'Delivery failed'), createdAt: new Date(row.created_at).toISOString() }));
  }),
  retry: adminQuery.input(z.object({ key: z.string().min(1).max(160) }).strict()).mutation(async ({ input }) => {
    await defaultOperationsPool().execute("UPDATE transactional_email_jobs SET job_status='PENDING',attempts=0,available_at=NOW() WHERE job_key=? AND job_status='FAILED'", [input.key]);
    return { queued: true };
  }),
});
