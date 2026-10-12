import { TRPCError } from '@trpc/server';
import type { RowDataPacket } from 'mysql2/promise';
import { withCheckoutLock } from './checkout-quote';
import { defaultOperationsPool } from './operations/mysql-query-client';
import { cleanupUncommittedSubmissionCopy, copySubmissionEvidence, submissionFingerprint } from './submission-evidence';
import { recordAuthoritySubmission } from './processing-guarantee';
import type { SubmissionEvidenceInput } from '../../contracts/submission-evidence';

/** Adds actual authority evidence after supplier submission, without repeating the status change or mail. */
export async function recordSupplierAuthorityConfirmation(applicationId: number, input: SubmissionEvidenceInput, key: string, actor: string, requiredOwnerId?: number) {
  let copy: { id: string; rollbackFile: string } | undefined;
  try {
    return await withCheckoutLock(applicationId, async connection => {
      const [owners] = await connection.execute<RowDataPacket[]>('SELECT assigned_staff_user_id FROM operations_case_controls WHERE application_id=? FOR UPDATE', [applicationId]);
      const owner = Number(owners[0]?.assigned_staff_user_id);
      if (requiredOwnerId !== undefined && owner !== requiredOwnerId) throw new TRPCError({code:'FORBIDDEN',message:'الطلب لم يعد مسندًا إليك. حدّث قائمة العمل.'});
      const hash = submissionFingerprint(applicationId, 'AUTHORITY_FILED', input);
      const [existing] = await connection.execute<RowDataPacket[]>('SELECT application_id,command_hash FROM operations_submission_evidence WHERE id=?', [key]);
      if (existing.length) {
        if (Number(existing[0].application_id) !== applicationId || existing[0].command_hash !== hash) throw new TRPCError({code:'CONFLICT',message:'تغيرت بيانات الإثبات. حدّث الطلب قبل المحاولة.'});
        return {saved:true as const};
      }
      const [applications] = await connection.execute<RowDataPacket[]>('SELECT status,payment_status FROM applications WHERE id=?', [applicationId]);
      const [proofs] = await connection.execute<RowDataPacket[]>('SELECT evidence_kind,supplier_id FROM operations_submission_evidence WHERE application_id=?', [applicationId]);
      if (applications[0]?.payment_status !== 'paid' || applications[0]?.status !== 'visa_processing' || !proofs.some(proof => proof.evidence_kind === 'SUPPLIER_SENT' && Number(proof.supplier_id) === input.supplierId) || proofs.some(proof => proof.evidence_kind === 'AUTHORITY_FILED')) {
        throw new TRPCError({code:'PRECONDITION_FAILED',message:'هذا الإجراء لإضافة إثبات الهجرة بعد التقديم للمورد، مرة واحدة أثناء انتظار النتيجة.'});
      }
      copy = await copySubmissionEvidence(connection, applicationId, 'AUTHORITY_FILED', input, actor, key);
      await recordAuthoritySubmission(connection, applicationId, actor, key);
      await connection.execute('UPDATE operations_case_controls SET version=version+1 WHERE application_id=?', [applicationId]);
      const reason = 'تم استلام رقم الطلب وإثبات التقديم الفعلي للهجرة من المورد.';
      await connection.execute(`INSERT INTO application_timeline_events(id,application_id,event_name,event_source,actor_type,actor_reference,summary)
        VALUES (?,?,'SUPPLIER_AUTHORITY_CONFIRMED','SUPPLIER_DESK',?,?,?)`, [key, applicationId, requiredOwnerId === undefined ? 'ADMIN' : 'STAFF', actor, reason]);
      const [states] = await connection.execute<RowDataPacket[]>('SELECT work_state FROM operations_case_work WHERE application_id=? FOR UPDATE', [applicationId]);
      if (Number.isSafeInteger(owner) && owner > 0 && states[0]?.work_state === 'WAIT_SUPPLIER') {
        await connection.execute("UPDATE operations_case_work SET work_state='WAIT_AUTHORITY',version=version+1,reason=?,changed_at=UTC_TIMESTAMP(3) WHERE application_id=?", [reason, applicationId]);
        await connection.execute(`INSERT INTO operations_work_events(staff_user_id,application_id,event_type,previous_state,next_state,reason,idempotency_key,command_hash,result_json)
          VALUES (?,?,'WORK_STATE','WAIT_SUPPLIER','WAIT_AUTHORITY',?,?,?,?)`, [owner, applicationId, reason, `authority-confirmation:${key}`, hash, JSON.stringify({applicationId,reference:null})]);
      }
      return {saved:true as const};
    });
  } catch (error) { if (copy) await cleanupUncommittedSubmissionCopy(copy, defaultOperationsPool()); throw error; }
}
