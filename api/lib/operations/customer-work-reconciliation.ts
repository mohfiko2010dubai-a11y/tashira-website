import { createHash, randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { WORK_STATES, workStateLabels } from '../../../contracts/work-queue';
import { customerWaitLog } from '../customer-wait-log';
import { customerWorkState } from './customer-work-state';

/** Refresh the existing owned work projection; immutable wait/financial evidence stays untouched. */
export async function reconcileCustomerWork(pool: Pool, staffId: number, applicationId: number) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Match the status/assignment writers' lock order. Recheck ownership inside it.
    const [applications] = await connection.execute<RowDataPacket[]>('SELECT status,substitution_version FROM applications WHERE id=? FOR UPDATE', [applicationId]);
    const [owners] = await connection.execute<RowDataPacket[]>('SELECT assigned_staff_user_id FROM operations_case_controls WHERE application_id=? FOR UPDATE', [applicationId]);
    const app = applications[0];
    if (!app || Number(owners[0]?.assigned_staff_user_id) !== staffId || ['completed', 'cancelled', 'rejected', 'visa_processing', 'visa_received'].includes(app.status)) {
      await connection.commit(); return;
    }
    const [work] = await connection.execute<RowDataPacket[]>('SELECT work_state,version,follow_up_at,UNIX_TIMESTAMP(changed_at)*1000 changed FROM operations_case_work WHERE application_id=? FOR UPDATE', [applicationId]);
    const [policy] = await connection.execute<RowDataPacket[]>('SELECT enabled_at FROM customer_wait_policy WHERE singleton=1');
    if (!policy[0]?.enabled_at) { await connection.commit(); return; }
    const [events] = await connection.execute<RowDataPacket[]>(`SELECT id,UNIX_TIMESTAMP(occurred_at)*1000 occurred FROM customer_wait_events
      WHERE application_id=? AND occurred_at>=? AND occurred_at<=UTC_TIMESTAMP(3) ORDER BY id`, [applicationId, policy[0].enabled_at]);
    const [quotes] = await connection.execute<RowDataPacket[]>(`SELECT id,state,difference_minor
      FROM visa_change_quotes WHERE application_id=? AND version=?`, [applicationId, app.substitution_version]);
    const [changes] = await connection.execute<RowDataPacket[]>(`SELECT id,action,UNIX_TIMESTAMP(occurred_at)*1000 occurred FROM product_substitution_events
      WHERE application_id=? AND version=? AND occurred_at>=? AND occurred_at<=UTC_TIMESTAMP(3) ORDER BY id`, [applicationId, app.substitution_version, policy[0].enabled_at]);
    if (!events.length && !changes.length) { await connection.commit(); return; }
    const quote = quotes[0] ? { id: String(quotes[0].id), state: String(quotes[0].state), difference: Number(quotes[0].difference_minor),
      paymentLinkIssued: changes.some(row => row.action === 'PAYMENT_LINK_ISSUED'), refusalResolved: changes.some(row => row.action === 'REFUSAL_RESOLVED') } : null;
    const hash = createHash('sha256').update(JSON.stringify({ events: events.map(row => row.id), changes: changes.map(row => row.id), quote })).digest('hex');
    const [prior] = await connection.execute<RowDataPacket[]>(`SELECT command_hash FROM operations_work_events
      WHERE application_id=? AND idempotency_key LIKE 'wait:%' ORDER BY id DESC LIMIT 1`, [applicationId]);
    // Stable evidence must not repeatedly undo the employee's deliberate follow-up.
    if (prior[0]?.command_hash === hash) { await connection.commit(); return; }
    const previous = z.enum(WORK_STATES).parse(work[0]?.work_state ?? (app.status === 'documents_pending' ? 'WAIT_CUSTOMER' : 'READY'));
    const waits = await customerWaitLog(applicationId, new Date(), connection);
    const newest = Math.max(...events.map(row => Number(row.occurred)), ...changes.map(row => Number(row.occurred)));
    // First observation of historic evidence is a baseline, not a backdated action.
    const historic = !prior.length && work.length > 0 && newest <= Number(work[0].changed);
    const next = historic ? previous : customerWorkState({ status: String(app.status), open: waits.open, quote }, previous);
    const waitingSince = waits.open[0]?.startedAt.getTime() ?? newest;
    const existingDue = previous === next ? work[0]?.follow_up_at ?? null : null;
    const due = existingDue ?? (next === 'WAIT_CUSTOMER' && (!historic || waits.open.length > 0) ? new Date(waitingSince + waits.thresholdHours * 3_600_000) : null);
    const reason = previous === next ? 'تمت مراجعة ردود العميل دون تغيير قائمة المتابعة.' : `تم تحديث المتابعة بعد رد العميل: ${workStateLabels[next]}.`;
    if (next !== previous || (!existingDue && due)) await connection.execute(`INSERT INTO operations_case_work(application_id,work_state,version,reason,follow_up_at) VALUES (?,?,1,?,?)
      ON DUPLICATE KEY UPDATE work_state=VALUES(work_state),version=version+1,reason=VALUES(reason),follow_up_at=VALUES(follow_up_at),changed_at=UTC_TIMESTAMP(3)`, [applicationId, next, reason, due]);
    await connection.execute(`INSERT INTO operations_work_events
      (staff_user_id,application_id,event_type,previous_state,next_state,reason,follow_up_at,idempotency_key,command_hash,result_json)
      VALUES (?,?,'WORK_STATE',?,?,?,?,?,?,?)`, [staffId, applicationId, previous, next, reason, due, `wait:${randomUUID()}`, hash, JSON.stringify({ applicationId, reference: null })]);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function reconcileOwnedCustomerWork(pool: Pool, staffId: number) {
  const [cases] = await pool.execute<RowDataPacket[]>(`SELECT a.id FROM applications a JOIN operations_case_controls c ON c.application_id=a.id
    WHERE c.assigned_staff_user_id=? AND a.status NOT IN ('completed','cancelled','rejected','visa_processing','visa_received')
    AND (EXISTS(SELECT 1 FROM customer_wait_events e WHERE e.application_id=a.id)
      OR EXISTS(SELECT 1 FROM visa_change_quotes q WHERE q.application_id=a.id)) ORDER BY a.id`, [staffId]);
  for (const row of cases) await reconcileCustomerWork(pool, staffId, Number(row.id));
}
