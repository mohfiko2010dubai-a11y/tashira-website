import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { EmailTemplate } from './transactional-email';

const copy: Record<string, { en: string; ar: string; event: string; template: EmailTemplate }> = {
  submitted: { en: 'Application submitted', ar: 'تم استلام الطلب', event: 'APPLICATION_SUBMITTED', template: 'STATUS_CHANGED' },
  payment_received: { en: 'Payment received', ar: 'تم استلام الدفع', event: 'APPLICATION_STATUS_CHANGED', template: 'STATUS_CHANGED' },
  documents_pending: { en: 'Documents are required. Open your application to review what is missing.', ar: 'مستندات مطلوبة. افتح طلبك لمراجعة المستندات الناقصة.', event: 'APPLICATION_STATUS_CHANGED', template: 'STATUS_CHANGED' },
  documents_received: { en: 'Documents received for review', ar: 'تم استلام المستندات للمراجعة', event: 'APPLICATION_STATUS_CHANGED', template: 'STATUS_CHANGED' },
  under_review: { en: 'Under review by TASHIRA', ar: 'الطلب قيد المراجعة لدى تاشيرة', event: 'PROCESSING_STARTED', template: 'STATUS_CHANGED' },
  visa_processing: { en: 'Submitted to the authority for processing', ar: 'تم تقديم الطلب إلى الجهة المختصة للمعالجة', event: 'GOVERNMENT_PROCESSING', template: 'SUBMITTED' },
  visa_received: { en: 'Visa received', ar: 'تم استلام التأشيرة', event: 'VISA_ISSUED', template: 'VISA_ISSUED' },
  completed: { en: 'Application completed', ar: 'تم إنجاز الطلب', event: 'APPLICATION_COMPLETED', template: 'STATUS_CHANGED' },
  cancelled: { en: 'Application cancelled. Any refund is confirmed separately.', ar: 'تم إلغاء الطلب. يتم تأكيد أي استرداد برسالة منفصلة.', event: 'APPLICATION_CANCELLED', template: 'STATUS_CHANGED' },
  rejected: { en: 'Application rejected', ar: 'تم رفض الطلب', event: 'APPLICATION_REJECTED', template: 'REJECTED' },
};

/** Only called with an authorized, locked and persisted status change. No network IO. */
export async function enqueueApplicationStatusEmail(connection: PoolConnection, input: {
  applicationId: number; from: string; to: string; eventId: string; actor: string; actorType: 'STAFF' | 'ADMIN';
}) {
  if (input.from === input.to) return;
  const entry = copy[input.to];
  if (!entry) throw new Error('Unknown application status notification');
  const [rows] = await connection.execute<RowDataPacket[]>('SELECT status,preferred_language FROM applications WHERE id=?', [input.applicationId]);
  if (rows[0]?.status !== input.to) throw new Error('Status notification requires its persisted application state');
  const label = rows[0].preferred_language === 'ar' ? entry.ar : entry.en;
  await connection.execute(`INSERT INTO application_timeline_events
    (id,application_id,event_name,event_source,actor_type,actor_reference,resulting_state,summary)
    VALUES (?, ?, ?, 'STATUS_OUTBOX', ?, ?, ?, ?)`, [input.eventId, input.applicationId, entry.event, input.actorType, input.actor, input.to, label]);
  await connection.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
    VALUES (?,?,?,?)`, [`application-status:${input.eventId}`, input.applicationId, entry.template,
    JSON.stringify({ statusLabel: label, statusLabelEn: entry.en, statusLabelAr: entry.ar, sourceEvent: entry.event, statusEventId: input.eventId, recordedStatus: input.to })]);
}
