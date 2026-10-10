import { createHash } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { WorkState } from '../../../contracts/work-queue';
import { WORK_STATES, workStateLabels } from '../../../contracts/work-queue';
import { z } from 'zod';

export function workStateAfterStatus(status: string, previous: WorkState): WorkState {
  switch (status) {
    case 'completed': case 'cancelled': case 'rejected': return 'DONE';
    case 'documents_pending': return 'WAIT_CUSTOMER';
    case 'visa_processing': return 'WAIT_AUTHORITY';
    case 'under_review': return previous === 'ACTIVE' ? 'ACTIVE' : 'READY';
    case 'submitted': case 'payment_received': case 'documents_received': case 'visa_received': return 'READY';
    default: throw new Error('Unsupported application status for work projection');
  }
}

/** Called inside the application's existing locked transaction, never after commit. */
export async function syncCaseWorkStatus(connection: PoolConnection, applicationId: number, from: string, to: string, eventId: string) {
  if (from === to) return;
  const [owners] = await connection.execute<RowDataPacket[]>('SELECT assigned_staff_user_id FROM operations_case_controls WHERE application_id=? FOR UPDATE', [applicationId]);
  const ownerId = Number(owners[0]?.assigned_staff_user_id);
  // Unassigned cases remain in the shared queue; never invent a staff owner.
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) return;
  const [states] = await connection.execute<RowDataPacket[]>('SELECT work_state,follow_up_at FROM operations_case_work WHERE application_id=? FOR UPDATE', [applicationId]);
  const previous = z.enum(WORK_STATES).parse(states[0]?.work_state ?? workStateAfterStatus(from, 'READY'));
  const next = workStateAfterStatus(to, previous);
  const followUpAt = previous === next ? states[0]?.follow_up_at ?? null : null;
  const reason = `تم تحديث المتابعة بعد حفظ حالة الطلب: ${workStateLabels[next]}.`;
  await connection.execute(`INSERT INTO operations_case_work (application_id,work_state,version,reason,follow_up_at) VALUES (?,?,1,?,?)
    ON DUPLICATE KEY UPDATE work_state=VALUES(work_state),version=version+1,reason=VALUES(reason),follow_up_at=VALUES(follow_up_at),changed_at=UTC_TIMESTAMP(3)`, [applicationId, next, reason, followUpAt]);
  const key = `status:${createHash('sha256').update(`${applicationId}:${eventId}`).digest('hex')}`;
  await connection.execute(`INSERT INTO operations_work_events
    (staff_user_id,application_id,event_type,previous_state,next_state,reason,follow_up_at,idempotency_key,command_hash,result_json)
    VALUES (?,?,'WORK_STATE',?,?,?,?,?,?,?)`, [ownerId, applicationId, previous, next, reason, followUpAt, key,
    createHash('sha256').update(JSON.stringify({ applicationId, from, to })).digest('hex'), JSON.stringify({ applicationId, reference: null })]);
}
