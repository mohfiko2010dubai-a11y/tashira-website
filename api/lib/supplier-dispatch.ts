import { TRPCError } from '@trpc/server';
import type { RowDataPacket } from 'mysql2/promise';
import { withCheckoutLock } from './checkout-quote';
import { defaultOperationsPool } from './operations/mysql-query-client';
import { cleanupUncommittedSubmissionCopy, copySubmissionEvidence, submissionFingerprint } from './submission-evidence';
import type { SubmissionEvidenceInput } from '../../contracts/submission-evidence';

export async function recordSupplierDispatch(applicationId: number, input: SubmissionEvidenceInput, key: string, actor: string, requiredOwnerId?: number) {
  let copy: { id: string; rollbackFile: string } | undefined;
  try {
    return await withCheckoutLock(applicationId, async connection => {
      const [owners] = await connection.execute<RowDataPacket[]>('SELECT assigned_staff_user_id FROM operations_case_controls WHERE application_id=? FOR UPDATE', [applicationId]);
      const owner = Number(owners[0]?.assigned_staff_user_id);
      if (requiredOwnerId !== undefined && owner !== requiredOwnerId) throw new TRPCError({ code: 'FORBIDDEN', message: 'الطلب لم يعد مسندًا إليك. حدّث قائمة العمل.' });
      const hash = submissionFingerprint(applicationId, 'SUPPLIER_SENT', input);
      const [existing] = await connection.execute<RowDataPacket[]>('SELECT application_id,command_hash FROM operations_submission_evidence WHERE id=?', [key]);
      if (existing.length) {
        if (Number(existing[0].application_id) !== applicationId || existing[0].command_hash !== hash) throw new TRPCError({ code: 'CONFLICT', message: 'تغيرت بيانات هذا الإرسال. حدّث الطلب قبل تسجيل إرسال آخر.' });
        return { saved: true as const };
      }
      const [applications] = await connection.execute<RowDataPacket[]>('SELECT status,payment_status FROM applications WHERE id=?', [applicationId]);
      if (applications[0]?.payment_status !== 'paid' || !['documents_received', 'under_review'].includes(String(applications[0]?.status))) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'سجّل اكتمال المستندات واستلام الدفع قبل إرسال الملف إلى المورد.' });
      copy = await copySubmissionEvidence(connection, applicationId, 'SUPPLIER_SENT', input, actor, key);
      await connection.execute(`INSERT INTO application_timeline_events(id,application_id,event_name,event_source,actor_type,actor_reference,summary)
        VALUES (?,?,'SUPPLIER_DOCUMENTS_SENT','SUPPLIER_DESK',?,?,'تم تسجيل إرسال الملف إلى المورد؛ لم يُؤكد تقديمه للهجرة بعد.')`, [key, applicationId, requiredOwnerId === undefined ? 'ADMIN' : 'STAFF', actor]);
      if (Number.isSafeInteger(owner) && owner > 0) {
        const [states] = await connection.execute<RowDataPacket[]>('SELECT work_state FROM operations_case_work WHERE application_id=? FOR UPDATE', [applicationId]);
        const reason = 'تم إرسال الملف إلى المورد؛ بانتظار إثبات التقديم أو الرد.';
        const due = new Date(input.followUpAt!);
        await connection.execute(`INSERT INTO operations_case_work(application_id,work_state,version,reason,follow_up_at) VALUES (?,'WAIT_SUPPLIER',1,?,?)
          ON DUPLICATE KEY UPDATE work_state='WAIT_SUPPLIER',version=version+1,reason=VALUES(reason),follow_up_at=VALUES(follow_up_at),changed_at=UTC_TIMESTAMP(3)`, [applicationId, reason, due]);
        await connection.execute(`INSERT INTO operations_work_events(staff_user_id,application_id,event_type,previous_state,next_state,reason,follow_up_at,idempotency_key,command_hash,result_json)
          VALUES (?,?,'WORK_STATE',?,'WAIT_SUPPLIER',?,?,?,?,?)`, [owner, applicationId, states[0]?.work_state ?? 'READY', reason, due, `dispatch:${key}`, hash, JSON.stringify({ applicationId, reference: null })]);
      }
      return { saved: true as const };
    });
  } catch (error) { if (copy) await cleanupUncommittedSubmissionCopy(copy, defaultOperationsPool()); throw error; }
}
