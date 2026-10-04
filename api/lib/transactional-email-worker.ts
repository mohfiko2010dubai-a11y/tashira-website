import type { RowDataPacket } from 'mysql2/promise';
import { defaultOperationsPool } from './operations/mysql-query-client';
import { sendCustomerNotification } from './customer-notification-email';
import { sendPaymentSuccessEmail } from './payment-success-email';
import { sendRefundOutcomeEmail } from './refund-outcome-email';
import { adminEmailRecipient } from './email-provider';
import { publicAppOrigin } from './public-app-url';
import { EMAIL_TEMPLATES, type EmailTemplate } from './transactional-email';
import { adminEmailActionUrl, isAdminEmail } from './email-audience';

// Durable source events, not UI actions: retries and process restarts do not lose mail.
export const timelineEmailTemplates: Readonly<Record<string, EmailTemplate>> = {
  APPLICATION_CREATED: 'APPLICATION_RECEIVED', PAYMENT_CONFIRMED: 'PAYMENT_SUCCESS',
  GOVERNMENT_PROCESSING: 'SUBMITTED', SUBMITTED_TO_AUTHORITY: 'SUBMITTED',
  VISA_ISSUED: 'VISA_ISSUED', APPLICATION_REJECTED: 'REJECTED', REJECTED: 'REJECTED',
  ADDITIONAL_DOCUMENTS_REQUESTED: 'DOCUMENTS_REQUIRED', MISSING_DOCUMENTS: 'DOCUMENTS_REQUIRED',
  ADDITIONAL_INFORMATION_REQUIRED: 'DOCUMENTS_REQUIRED', REFUND_COMPLETED: 'REFUND_COMPLETED',
};
async function seedJobs() {
  const pool = defaultOperationsPool();
  for (const [event, template] of Object.entries(timelineEmailTemplates)) {
    await pool.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
      SELECT CONCAT('timeline:',e.id),e.application_id,?,JSON_OBJECT('sourceEvent',e.event_name,'sourceReference',COALESCE(e.actor_reference,''))
      FROM application_timeline_events e WHERE e.event_name=? AND e.created_at >= (SELECT enabled_at FROM transactional_email_start WHERE singleton=1)
      ON DUPLICATE KEY UPDATE job_key=transactional_email_jobs.job_key`, [template, event]);
  }
  await pool.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
    SELECT CONCAT('documents-complete:',c.application_id),c.application_id,'DOCUMENTS_COMPLETE',JSON_OBJECT()
    FROM application_service_clocks c WHERE c.documents_completed_at >= (SELECT enabled_at FROM transactional_email_start WHERE singleton=1)
    ON DUPLICATE KEY UPDATE job_key=transactional_email_jobs.job_key`);
  await pool.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
    SELECT CONCAT('substitution:',a.id,':',a.substitution_version),a.id,'PRODUCT_SUBSTITUTED',JSON_OBJECT('originalProduct',a.visa_type,'replacementProduct',a.submitted_product)
    FROM applications a WHERE a.submitted_product IS NOT NULL AND (a.substitution_acknowledged_version IS NULL OR a.substitution_acknowledged_version<>a.substitution_version)
    ON DUPLICATE KEY UPDATE job_key=transactional_email_jobs.job_key`);
  await pool.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
    SELECT CONCAT('document-event:',e.id),e.document_event_application_id,'DOCUMENTS_REQUIRED',JSON_OBJECT('documentList',CONCAT(d.document_type,': ',COALESCE(e.document_event_reason,'')))
    FROM document_lifecycle_events e JOIN documents d ON d.id=e.document_event_document_id
    WHERE e.document_lifecycle_event_type='REPLACEMENT_REQUESTED' AND e.created_at >= (SELECT enabled_at FROM transactional_email_start WHERE singleton=1)
    ON DUPLICATE KEY UPDATE job_key=transactional_email_jobs.job_key`);
  await pool.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
    SELECT CONCAT('approval:',id),application_id,'APPROVAL_PENDING',JSON_OBJECT('admin','1') FROM refund_cases WHERE refund_case_status='PENDING_APPROVAL'
    ON DUPLICATE KEY UPDATE job_key=transactional_email_jobs.job_key`);
  await pool.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
    SELECT CONCAT('guarantee:',id),application_id,'GUARANTEE_BREACHED',JSON_OBJECT('admin','1') FROM refund_cases WHERE approved_by='SYSTEM:EXPRESS_GUARANTEE'
    ON DUPLICATE KEY UPDATE job_key=transactional_email_jobs.job_key`);
  await pool.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
    SELECT CONCAT('refund-connection:',id),application_id,'CONNECTION_BROKEN',JSON_OBJECT('admin','1') FROM refund_cases WHERE refund_case_status='FAILED'
    ON DUPLICATE KEY UPDATE job_key=transactional_email_jobs.job_key`);
  await pool.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
    SELECT CONCAT('resume:',id),id,'RESUME_REMINDER',JSON_OBJECT() FROM applications WHERE payment_status='pending'
    AND created_at >= (SELECT enabled_at FROM transactional_email_start WHERE singleton=1) AND updated_at < DATE_SUB(NOW(),INTERVAL 24 HOUR)
    AND status NOT IN ('cancelled','rejected','completed') ON DUPLICATE KEY UPDATE job_key=transactional_email_jobs.job_key`);
  // Ask only after recorded delivery, not simply after the authority issued a visa.
  await pool.execute(`INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json)
    SELECT CONCAT('review:',application_id),application_id,'REVIEW_REQUEST',JSON_OBJECT() FROM application_timeline_events
    WHERE event_name='VISA_DOWNLOADED' AND created_at >= (SELECT enabled_at FROM transactional_email_start WHERE singleton=1)
    AND created_at < DATE_SUB(NOW(),INTERVAL 24 HOUR) ON DUPLICATE KEY UPDATE job_key=transactional_email_jobs.job_key`);
}

async function dispatch(job: RowDataPacket): Promise<'SENT' | 'FAILED' | 'SUPPRESSED'> {
  const pool = defaultOperationsPool();
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT reference_number,contact_email,preferred_language,processing_type,payment_status,status,visa_type,submitted_product,substitution_version,substitution_acknowledged_version FROM applications WHERE id=?', [job.application_id]);
  const application = rows[0];
  if (!application) throw new Error('Email owner is missing');
  const variables: Record<string, string> = typeof job.variables_json === 'string' ? JSON.parse(job.variables_json) : job.variables_json;
  const template = EMAIL_TEMPLATES.find(value => value === job.template);
  if (!template) throw new Error('Unknown mail template');
  // A queued proposal must never describe a replaced or already accepted version.
  if (template === 'PRODUCT_SUBSTITUTED' && (
    job.job_key !== `substitution:${job.application_id}:${application.substitution_version}` ||
    application.substitution_acknowledged_version === application.substitution_version ||
    variables.originalProduct !== application.visa_type || variables.replacementProduct !== application.submitted_product
  )) return 'SUPPRESSED';
  if (template === 'RESUME_REMINDER' && (application.payment_status !== 'pending' || ['cancelled','rejected','completed'].includes(application.status))) return 'SUPPRESSED';
  if (template === 'PAYMENT_SUCCESS') {
    const [invoices] = await pool.execute<RowDataPacket[]>(`SELECT i.invoice_number,i.amount,i.pdf_path,i.payment_id,p.currency FROM invoices i JOIN payments p ON p.id=i.payment_id WHERE i.application_id=? ORDER BY i.id DESC LIMIT 1`, [job.application_id]);
    if (!invoices[0]) return 'FAILED';
    const invoice = invoices[0];
    const result = await sendPaymentSuccessEmail({ applicationId: Number(job.application_id), paymentId: Number(invoice.payment_id), recipient: application.contact_email, referenceNumber: application.reference_number, invoiceNumber: invoice.invoice_number, amountPaid: Number(invoice.amount), currency: invoice.currency, invoicePdfPath: invoice.pdf_path });
    return result.status === 'SENT' || result.status === 'ALREADY_SENT' ? 'SENT' : 'FAILED';
  }
  if (template === 'REFUND_COMPLETED') {
    const [refunds] = await pool.execute<RowDataPacket[]>("SELECT id FROM refund_cases WHERE application_id=? AND refund_case_status IN ('REFUNDED','PARTIALLY_REFUNDED')", [job.application_id]);
    if (!refunds.length) return 'FAILED';
    for (const refund of refunds) { const result = await sendRefundOutcomeEmail(refund.id); if (!['SENT','ALREADY_SENT'].includes(result.status)) return 'FAILED'; }
    return 'SENT';
  }
  const recipient = isAdminEmail(template) ? adminEmailRecipient() : String(application.contact_email);
  if (!recipient) throw new Error('Configure the monitored administrator notification address, then retry this message.');
  const refundCaseId = isAdminEmail(template) ? String(job.job_key).split(':').at(-1) || '' : '';
  const actionUrl = isAdminEmail(template) ? adminEmailActionUrl(template, { ...variables, refundCaseId }) : `${publicAppOrigin()}/${application.preferred_language}/track`;
  const result = await sendCustomerNotification({ applicationId: Number(job.application_id), recipient, template,
    variables: { ...variables, refundCaseId, processingType: application.processing_type, referenceNumber: application.reference_number, actionUrl }, sourceReference: template === 'VISA_ISSUED' ? 'status:visa_received' : template === 'REJECTED' ? 'status:rejected' : template === 'SUBMITTED' ? 'status:visa_processing' : String(job.job_key), failureCategory: 'transactional_delivery_failed' });
  return result.status !== 'FAILED' ? 'SENT' : 'FAILED';
}
let running = false;
export async function runTransactionalEmails(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await seedJobs();
    const pool = defaultOperationsPool();
    // Recover a crashed worker without assigning a new provider idempotency key.
    await pool.execute("UPDATE transactional_email_jobs SET job_status='PENDING' WHERE job_status='SENDING' AND claimed_at<DATE_SUB(NOW(),INTERVAL 10 MINUTE)");
    for (let i = 0; i < 20; i++) {
      const connection = await pool.getConnection();
      let job: RowDataPacket | undefined;
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute<RowDataPacket[]>("SELECT * FROM transactional_email_jobs WHERE job_status IN ('PENDING','FAILED') AND attempts<6 AND available_at<=NOW() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED");
        job = rows[0];
        if (job) await connection.execute("UPDATE transactional_email_jobs SET job_status='SENDING',claimed_at=NOW(),attempts=attempts+1 WHERE job_key=?", [job.job_key]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
      if (!job) break;
      let failure = 'Delivery failed. Check the mail provider and recipient settings, then retry.';
      const status = await dispatch(job).catch((error: unknown) => { if (error instanceof Error && error.message.startsWith('Configure the monitored administrator')) failure = error.message; return 'FAILED' as const; });
      await pool.execute("UPDATE transactional_email_jobs SET job_status=?,failure_message=?,available_at=DATE_ADD(NOW(),INTERVAL 10 MINUTE) WHERE job_key=?", [status, status === 'FAILED' ? failure : null, job.job_key]);
    }
  } finally { running = false; }
}
export function startTransactionalEmailWorker(): void {
  const tick = () => { void runTransactionalEmails().catch(() => console.error('[Email worker] Dispatch failed; inspect the durable email queue')); };
  const timer = setInterval(tick, 60_000); timer.unref(); tick();
}
