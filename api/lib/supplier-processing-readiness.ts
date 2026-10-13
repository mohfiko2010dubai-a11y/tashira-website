import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { TRPCError } from '@trpc/server';

/** Caller holds the application checkout lock. A link or original receipt never settles an amendment. */
export async function assertSupplierProcessingReady(connection: PoolConnection, applicationId: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(`SELECT a.payment_status,q.state,q.difference_minor,
    EXISTS(SELECT 1 FROM visa_change_decisions d WHERE d.quote_id=q.id AND d.state='APPROVED'
      AND d.kind='REFUSAL_OUTCOME' AND d.outcome='ORIGINAL_AT_CUSTOMER_REQUEST') original_approved
    FROM applications a LEFT JOIN visa_change_quotes q ON q.application_id=a.id AND q.version=a.substitution_version WHERE a.id=?`, [applicationId]);
  const row = rows[0];
  if (!row || row.payment_status !== 'paid') throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'الطلب لم يتلقَّ دفعًا مؤكدًا بعد.' });
  if (!row.state || row.state === 'SETTLED' || row.state === 'REFUSED' && row.original_approved) return;
  const message = row.state === 'PROPOSED' ? 'بانتظار موافقة العميل على تعديل التأشيرة.'
    : Number(row.difference_minor) > 0 ? 'بانتظار استلام وتسوية فرق تعديل التأشيرة. الدفعة الأصلية مسجّلة ولا تحتاج تأكيدًا جديدًا.'
    : Number(row.difference_minor) < 0 ? 'بانتظار تسوية رد فرق تعديل التأشيرة.' : 'يلزم إنهاء قرار تعديل التأشيرة أولًا.';
  throw new TRPCError({ code: 'PRECONDITION_FAILED', message });
}
