import { z } from 'zod';
import type { RowDataPacket } from 'mysql2/promise';
import { adminQuery, createRouter } from './middleware';
import { defaultOperationsPool } from './lib/operations/mysql-query-client';

export const emailOperationsRouter = createRouter({
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
