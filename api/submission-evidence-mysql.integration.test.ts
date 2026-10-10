import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { createRouter } from './middleware';
import { documentRouter } from './document-router';
import { storageRouter } from './storage-router';
import { applicationRouter } from './application-router';
import type { TrpcContext } from './context';
import { MysqlOperationsAccessProvider } from './lib/operations/mysql-access-provider';
import { MysqlOperationsSqlClient } from './lib/operations/mysql-query-client';
import { MysqlControlledWriteExecutor } from './lib/operations/mysql-controlled-write-executor';
import { recordSupplierDispatch } from './lib/supplier-dispatch';
import { cleanupUncommittedSubmissionCopy } from './lib/submission-evidence';
import { resolveStoragePath, storageUpload, storageDelete } from './lib/local-storage';

const url = process.env.OPS_REHEARSAL_DATABASE_URL;
describe.skipIf(!url).sequential('protected supplier and authority evidence in disposable MySQL', () => {
  let pool: Pool, access: MysqlOperationsAccessProvider, writes: MysqlControlledWriteExecutor;
  let supplierId: number, staffId: number, root: string;
  const oldRoot = process.env.STORAGE_ROOT;
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAioAAAAASUVORK5CYII=', 'base64');
  const context = (): TrpcContext => ({ staffId, isAdmin: false, req: new Request('https://example.invalid'), resHeaders: new Headers(), customerApplicationReferences: new Set() });
  const router = createRouter({ document: documentRouter, storage: storageRouter, application: applicationRouter });
  async function fixture() {
    const [app] = await pool.execute<ResultSetHeader>(`INSERT INTO applications
      (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status,data_classification,is_test,created_at,supplier_id,supplier_cost_aed,supplier_total_aed)
      VALUES (?,'single','non-gcc','ROUTE_TEST','regular','proof@example.invalid','000',1,100,'under_review','paid','TEST',1,'2020-01-01',?,50,50)`, [`PROOF-${randomUUID()}`, supplierId]);
    await pool.execute("INSERT INTO applicants(application_id,applicant_index,full_name) VALUES (?,0,'Synthetic Proof Traveller')", [app.insertId]);
    await pool.execute('INSERT INTO operations_case_controls(application_id,assigned_staff_user_id) VALUES (?,?)', [app.insertId, staffId]);
    const storagePath = `applications/${app.insertId}/supporting/source.png`;
    await storageUpload(storagePath, bytes, 'image/png');
    const [doc] = await pool.execute<ResultSetHeader>(`INSERT INTO documents
      (application_id,document_type,original_file_name,stored_file_name,mime_type,file_size,storage_provider,storage_bucket,storage_path,upload_status,uploaded_by)
      VALUES (?,'supporting','Synthetic.png','source.png','image/png',?,'local','documents',?,'uploaded','synthetic')`, [app.insertId, bytes.length, storagePath]);
    return { applicationId: app.insertId, storagePath, input: { supplierId, documentId: doc.insertId, externalReference: 'SYNTHETIC-REFERENCE', occurredAt: new Date(Date.now() - 60_000).toISOString(), followUpAt: new Date(Date.now() + 86400_000).toISOString() } };
  }
  async function state(id: number) {
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT a.status,w.work_state,c.authority_submitted_at,
      (SELECT COUNT(*) FROM operations_submission_evidence e WHERE e.application_id=a.id) proofs,
      (SELECT COUNT(*) FROM transactional_email_jobs j WHERE j.application_id=a.id) mails
      FROM applications a LEFT JOIN operations_case_work w ON w.application_id=a.id LEFT JOIN application_service_clocks c ON c.application_id=a.id WHERE a.id=?`, [id]);
    return rows[0];
  }
  beforeAll(async () => {
    const target = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '33306' || !target.pathname.startsWith('/tashira_ops_rehearsal_')) throw new Error('Disposable database required');
    root = await mkdtemp(path.join(tmpdir(), 'tashira-proof-'));
    process.env.STORAGE_ROOT = root;
    pool = createPool({ uri: url, connectionLimit: 6 });
    access = new MysqlOperationsAccessProvider(new MysqlOperationsSqlClient(pool));
    writes = new MysqlControlledWriteExecutor(pool, access);
    const tag = randomUUID().slice(0, 8);
    const [supplier] = await pool.execute<ResultSetHeader>("INSERT INTO suppliers(name,is_active) VALUES (?,'active')", [`Synthetic proof ${tag}`]);
    supplierId = supplier.insertId;
    const [role] = await pool.execute<ResultSetHeader>('INSERT INTO operations_roles(code,name) VALUES (?,?)', [`PROOF_${tag}`, `Proof ${tag}`]);
    for (const permission of ['case.read_assigned', 'case.transition', 'document.read', 'document.review', 'supplier.read_operational']) {
      await pool.execute("INSERT INTO operations_permissions(code,description,risk_level) VALUES (?,'Synthetic proof permission','HIGH') ON DUPLICATE KEY UPDATE code=VALUES(code)", [permission]);
      await pool.execute("INSERT INTO operations_role_permissions(role_id,permission_id,granted_by) SELECT ?,id,'synthetic' FROM operations_permissions WHERE code=?", [role.insertId, permission]);
    }
    const [staff] = await pool.execute<ResultSetHeader>("INSERT INTO staff_users(username,password_hash,name,is_active,staff_role) VALUES (?,'unusable','Synthetic Proof Staff','active','staff')", [`proof-${tag}`]);
    staffId = staff.insertId;
    await pool.execute("INSERT INTO operations_staff_roles(staff_user_id,role_id,granted_by,valid_from) VALUES (?,?,'synthetic',UTC_TIMESTAMP())", [staffId, role.insertId]);
    await pool.execute("INSERT INTO operations_scope_grants(staff_user_id,scope_type,granted_by) VALUES (?,'ASSIGNED','synthetic')", [staffId]);
    await pool.execute(`INSERT INTO operations_feature_flags(flag_key,environment,enabled,scope_type,scope_reference,reason,changed_by)
      VALUES ('OPERATIONS_CONTROLLED_WRITES','TEST','YES','GLOBAL','','Synthetic proof','synthetic') ON DUPLICATE KEY UPDATE enabled='YES'`);
  });
  afterAll(async () => {
    await pool?.end();
    if (oldRoot === undefined) delete process.env.STORAGE_ROOT; else process.env.STORAGE_ROOT = oldRoot;
    if (root && path.dirname(root) === path.resolve(tmpdir()) && path.basename(root).startsWith('tashira-proof-')) await rm(root, { recursive: true, force: true });
  });
  it('records supplier dispatch once in follow-up without falsely recording government filing or emailing the customer', async () => {
    const f = await fixture(), key = randomUUID();
    await Promise.all([1, 2].map(() => recordSupplierDispatch(f.applicationId, f.input, key, `staff:${staffId}`, staffId)));
    expect(await state(f.applicationId)).toMatchObject({ status: 'under_review', work_state: 'WAIT_SUPPLIER', authority_submitted_at: null, proofs: 1, mails: 0 });
    await expect(recordSupplierDispatch(f.applicationId, { ...f.input, externalReference: 'changed' }, key, `staff:${staffId}`, staffId)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('rejects wrong owner, foreign document, future filing and missing price with no evidence or files', async () => {
    const f = await fixture(), foreign = await fixture();
    const send = (input = f.input, owner = staffId) => recordSupplierDispatch(f.applicationId, input, randomUUID(), `staff:${staffId}`, owner);
    await expect(send(f.input, staffId + 9999)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(send({ ...f.input, documentId: foreign.input.documentId })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(send({ ...f.input, occurredAt: f.input.followUpAt })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await pool.execute('UPDATE applications SET supplier_total_aed=NULL WHERE id=?', [f.applicationId]);
    await expect(send()).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    const [rate] = await pool.execute<ResultSetHeader>(`INSERT INTO supplier_product_rates
      (supplier_id,service_code,processing_type,version,cost_aed,vat_amount_aed,total_aed,vat_status,place_of_supply,active,reason,created_by)
      VALUES (?,'DIFFERENT-SYNTHETIC-PRODUCT','regular',1,50,0,50,'exempt','within_uae',1,'Synthetic stale snapshot','synthetic')`, [supplierId]);
    await pool.execute('UPDATE applications SET supplier_total_aed=50,supplier_rate_id=?,supplier_rate_quantity=1 WHERE id=?', [rate.insertId, f.applicationId]);
    await expect(send()).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect((await state(f.applicationId)).proofs).toBe(0);
    expect(await readdir(path.dirname(resolveStoragePath(f.storagePath)))).toEqual(['source.png']);
  });
  it('retains readable hashed evidence after source deletion and refuses all five document mutation routes', async () => {
    const f = await fixture();
    await recordSupplierDispatch(f.applicationId, f.input, randomUUID(), `staff:${staffId}`, staffId);
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT e.document_id,e.content_sha256,d.storage_path FROM operations_submission_evidence e JOIN documents d ON d.id=e.document_id WHERE e.application_id=?', [f.applicationId]);
    const id = Number(rows[0].document_id), caller = router.createCaller(context());
    await storageDelete(f.storagePath);
    expect(await readFile(resolveStoragePath(rows[0].storage_path))).toEqual(bytes);
    expect(rows[0].content_sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    for (const mutation of [
      () => caller.document.delete({ id }),
      () => caller.document.updateStatus({ id, uploadStatus: 'replaced' }),
      () => caller.document.requestReplacement({ id, reason: 'Synthetic replacement' }),
      () => caller.storage.delete({ documentId: id }),
      () => caller.storage.replace({ documentId: id, applicationId: f.applicationId, documentType: 'supporting', fileName: 'replacement.png', mimeType: 'image/png', fileSize: bytes.length, base64Data: bytes.toString('base64') }),
    ]) await expect(mutation()).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await readFile(resolveStoragePath(rows[0].storage_path))).toEqual(bytes);
    await expect(pool.execute('UPDATE operations_submission_evidence SET external_reference=? WHERE application_id=?', ['changed', f.applicationId])).rejects.toMatchObject({ sqlState: '45000' });
    await expect(pool.execute('DELETE FROM operations_submission_evidence WHERE application_id=?', [f.applicationId])).rejects.toMatchObject({ sqlState: '45000' });
  });
  it('requires proof then atomically records actual filing time, customer mail and authority queue; replay adds nothing', async () => {
    const f = await fixture(), actor = await access.actorForContext(context());
    const capabilities = await writes.capabilities(f.applicationId, actor);
    const command = { applicationId: f.applicationId, expectedVersion: capabilities.version, idempotencyKey: randomUUID(), reason: 'Synthetic authority filing', to: 'visa_processing' as const };
    await expect(writes.statusTransition(command, actor)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    const input = { ...command, submission: f.input };
    const result = await writes.statusTransition(input, actor);
    expect(await writes.statusTransition(input, actor)).toEqual({ ...result, status: 'IDEMPOTENT_REPLAY' });
    expect(await state(f.applicationId)).toMatchObject({ status: 'visa_processing', work_state: 'WAIT_AUTHORITY', authority_submitted_at: new Date(f.input.occurredAt), proofs: 1, mails: 1 });
  });
  it('rolls back proof, private file, status, clock and email together on audit failure', async () => {
    const f = await fixture(), actor = await access.actorForContext(context());
    const failure = new MysqlControlledWriteExecutor(pool, access, { beforeAuditPersist: () => { throw new Error('Synthetic audit failure'); } });
    const capabilities = await writes.capabilities(f.applicationId, actor);
    await expect(failure.statusTransition({ applicationId: f.applicationId, expectedVersion: capabilities.version, idempotencyKey: randomUUID(), reason: 'Synthetic rollback', to: 'visa_processing', submission: f.input }, actor)).rejects.toThrow();
    expect(await state(f.applicationId)).toMatchObject({ status: 'under_review', work_state: null, authority_submitted_at: null, proofs: 0, mails: 0 });
    expect(await readdir(path.dirname(resolveStoragePath(f.storagePath)))).toEqual(['source.png']);
  });
  it('never deletes a committed proof during ambiguous-commit cleanup and prevents cross-owner history reads', async () => {
    const f = await fixture(), key = randomUUID();
    await recordSupplierDispatch(f.applicationId, f.input, key, `staff:${staffId}`, staffId);
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT d.storage_path FROM operations_submission_evidence e JOIN documents d ON d.id=e.document_id WHERE e.id=?', [key]);
    await cleanupUncommittedSubmissionCopy({ id: key, rollbackFile: rows[0].storage_path }, pool);
    expect(await readFile(resolveStoragePath(rows[0].storage_path))).toEqual(bytes);
    const [apps] = await pool.execute<RowDataPacket[]>('SELECT reference_number FROM applications WHERE id=?', [f.applicationId]);
    const caller = router.createCaller(context());
    expect(await caller.application.submissionEvidence({ referenceNumber: apps[0].reference_number })).toHaveLength(1);
    await pool.execute('UPDATE operations_case_controls SET assigned_staff_user_id=NULL WHERE application_id=?', [f.applicationId]);
    await expect(caller.application.submissionEvidence({ referenceNumber: apps[0].reference_number })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
