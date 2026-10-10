import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { TRPCError } from '@trpc/server';
import { submissionEvidenceInput, type SubmissionEvidenceInput } from '../../contracts/submission-evidence';
import { resolveStoragePath, storageUpload, storageDelete, LOCAL_STORAGE_METADATA } from './local-storage';
import { defaultOperationsPool } from './operations/mysql-query-client';

export function submissionFingerprint(applicationId: number, kind: string, input: SubmissionEvidenceInput) {
  return createHash('sha256').update(JSON.stringify({ applicationId, kind, input: submissionEvidenceInput.parse(input) })).digest('hex');
}

export async function assertDocumentNotSubmissionEvidence(documentId: number) {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>('SELECT id FROM operations_submission_evidence WHERE document_id=? LIMIT 1', [documentId]);
  if (rows.length) throw new TRPCError({ code: 'CONFLICT', message: 'هذا الملف إثبات تقديم محفوظ في سجل الطلب. أضف إثباتًا جديدًا بدل حذف الإثبات السابق أو استبداله.' });
}

/** The application is locked by the caller. Only a fresh private copy becomes evidence. */
export async function copySubmissionEvidence(connection: PoolConnection, applicationId: number, kind: 'SUPPLIER_SENT' | 'AUTHORITY_FILED', raw: SubmissionEvidenceInput, actor: string, id: string = randomUUID()) {
  const input = submissionEvidenceInput.parse(raw);
  const [applications] = await connection.execute<RowDataPacket[]>(`SELECT a.supplier_id,a.supplier_cost_aed,a.supplier_total_aed,a.created_at,
    a.supplier_rate_id,a.supplier_rate_quantity,a.processing_type,r.supplier_id captured_supplier,r.service_code captured_product,r.processing_type captured_speed,
    COALESCE(a.submitted_product,a.visa_type) product,(SELECT COUNT(*) FROM applicants p WHERE p.application_id=a.id) quantity
    FROM applications a LEFT JOIN supplier_product_rates r ON r.id=a.supplier_rate_id WHERE a.id=?`, [applicationId]);
  const application = applications[0];
  if (!application || Number(application.supplier_id) !== input.supplierId) throw new TRPCError({ code: 'CONFLICT', message: 'تغير المورد. حدّث الطلب وراجع جهة التقديم قبل الحفظ.' });
  if (application.supplier_cost_aed == null || application.supplier_total_aed == null || Number(application.quantity) < 1) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'بيانات المورد أو تكلفته غير مكتملة. احفظ المورد بعد استكمال سعر التأشيرة وعدد المسافرين.' });
  if (application.supplier_rate_id && (Number(application.captured_supplier) !== input.supplierId || application.product !== application.captured_product || application.processing_type !== application.captured_speed || Number(application.quantity) !== Number(application.supplier_rate_quantity))) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'تغير المورد أو التأشيرة أو أعداد المسافرين بعد تحديد التكلفة. احفظ المورد لتحديث التكلفة أولًا.' });
  const occurredAt = new Date(input.occurredAt);
  const followUpAt = input.followUpAt ? new Date(input.followUpAt) : null;
  if (kind === 'SUPPLIER_SENT' && (!followUpAt || followUpAt.getTime() <= Date.now())) throw new TRPCError({ code: 'BAD_REQUEST', message: 'حدد موعد المتابعة القادم مع المورد ثم احفظ الإرسال.' });
  if (occurredAt.getTime() > Date.now() || occurredAt.getTime() < new Date(application.created_at).getTime()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'وقت الإرسال لا يمكن أن يسبق إنشاء الطلب أو يكون في المستقبل. أدخل الوقت الفعلي كما في الإثبات.' });
  const [documents] = await connection.execute<RowDataPacket[]>('SELECT * FROM documents WHERE id=? AND application_id=? FOR UPDATE', [input.documentId, applicationId]);
  const source = documents[0];
  if (!source || source.document_type !== 'supporting' || source.upload_status !== 'uploaded' || !['local', 'filesystem'].includes(String(source.storage_provider))
    || !['application/pdf', 'image/jpeg', 'image/png'].includes(String(source.mime_type))) throw new TRPCError({ code: 'BAD_REQUEST', message: 'اختر صورة أو PDF لإثبات التقديم من المرفقات الإضافية لهذا الطلب.' });
  let bytes: Buffer;
  try { bytes = await readFile(resolveStoragePath(String(source.storage_path))); }
  catch { throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'تعذر فتح ملف الإثبات. ارفع نسخة جديدة ثم اخترها.' }); }
  if (!bytes.length || bytes.length > 20 * 1024 * 1024 || bytes.length !== Number(source.file_size)) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'ملف الإثبات تغير أو غير مكتمل. ارفع نسخة جديدة ثم اخترها.' });
  const extension = source.mime_type === 'application/pdf' ? 'pdf' : source.mime_type === 'image/png' ? 'png' : 'jpg';
  const storedName = `submission-${id}.${extension}`, path = `applications/${applicationId}/supporting/${storedName}`;
  await storageUpload(path, bytes, String(source.mime_type));
  try {
    const [copy] = await connection.execute<ResultSetHeader>(`INSERT INTO documents
      (application_id,document_type,original_file_name,stored_file_name,mime_type,file_size,storage_provider,storage_bucket,storage_path,upload_status,uploaded_by)
      VALUES (?,'supporting',?,?,?,?,?,?,?,'uploaded',?)`, [applicationId, `Submission evidence.${extension}`, storedName, source.mime_type, bytes.length,
      LOCAL_STORAGE_METADATA.storageProvider, LOCAL_STORAGE_METADATA.storageBucket, path, actor]);
    await connection.execute(`INSERT INTO operations_submission_evidence
      (id,application_id,supplier_id,evidence_kind,external_reference,source_document_id,document_id,content_sha256,service_code,applicant_quantity,occurred_at,follow_up_at,command_hash,actor_reference)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, applicationId, input.supplierId, kind, input.externalReference, input.documentId, copy.insertId,
      createHash('sha256').update(bytes).digest('hex'), application.product, Number(application.quantity), occurredAt, followUpAt, submissionFingerprint(applicationId, kind, input), actor]);
    return { id, documentId: copy.insertId, occurredAt, rollbackFile: path };
  } catch (error) { await storageDelete(path).catch(() => undefined); throw error; }
}

export async function cleanupUncommittedSubmissionCopy(copy: { id: string; rollbackFile: string }, pool: Pick<Pool, 'execute'>) {
  try {
    // A commit response can be lost. Check durable evidence before removing any file.
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM operations_submission_evidence WHERE id=?', [copy.id]);
    if (!rows.length) await storageDelete(copy.rollbackFile);
  } catch { console.error('[Submission evidence] Failed transaction cleanup needs review'); }
}
