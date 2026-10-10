import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { captureScannedVisaFile,readVerifiedVisaFile,discardUncommittedVisaFile } from './lib/operations/visa-file-evidence';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { MysqlOperationsAccessProvider } from './lib/operations/mysql-access-provider';
import { MysqlOperationsSqlClient } from './lib/operations/mysql-query-client';
import { MysqlVisaDeliveryRepository } from './lib/operations/mysql-visa-delivery-repository';
import { prepareSecureVisaDelivery } from './lib/operations/visa-delivery-service';

const url = process.env.OPS_REHEARSAL_DATABASE_URL;
describe.skipIf(!url).sequential('assigned-owner visa delivery in disposable MySQL', () => {
  let pool: Pool, repository: MysqlVisaDeliveryRepository, access: MysqlOperationsAccessProvider;
  const staff: number[] = [];
  beforeAll(async () => {
    const target = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '33306' || !target.pathname.startsWith('/tashira_ops_rehearsal_')) throw new Error('Disposable database required');
    pool = createPool({ uri: url, connectionLimit: 6 });
    repository = new MysqlVisaDeliveryRepository(pool);
    access = new MysqlOperationsAccessProvider(new MysqlOperationsSqlClient(pool));
    const tag = randomUUID().slice(0, 8);
    const [role] = await pool.execute<ResultSetHeader>('INSERT INTO operations_roles(code,name) VALUES (?,?)', [`DEL_${tag}`, `Delivery ${tag}`]);
    await pool.execute("INSERT INTO operations_permissions(code,description,risk_level) VALUES ('document.review','Synthetic delivery','HIGH') ON DUPLICATE KEY UPDATE code=VALUES(code)");
    await pool.execute("INSERT INTO operations_role_permissions(role_id,permission_id,granted_by) SELECT ?,id,'synthetic' FROM operations_permissions WHERE code='document.review'", [role.insertId]);
    for (let index = 0; index < 2; index++) {
      const [person] = await pool.execute<ResultSetHeader>("INSERT INTO staff_users(username,password_hash,name,is_active,staff_role) VALUES (?,'unusable','Synthetic Delivery Staff','active','staff')", [`delivery-${tag}-${index}`]);
      staff.push(person.insertId);
      await pool.execute("INSERT INTO operations_staff_roles(staff_user_id,role_id,granted_by,valid_from) VALUES (?,?,'synthetic',UTC_TIMESTAMP())", [person.insertId, role.insertId]);
      await pool.execute("INSERT INTO operations_scope_grants(staff_user_id,scope_type,granted_by) VALUES (?,'ASSIGNED','synthetic')", [person.insertId]);
    }
  });
  afterAll(async () => { await pool?.end(); });
  async function fixture() {
    const reference = `DEL-${randomUUID()}`;
    const [app] = await pool.execute<ResultSetHeader>(`INSERT INTO applications
      (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status,data_classification,is_test)
      VALUES (?,'single','non-gcc','ROUTE_TEST','regular','delivery@example.invalid','000',1,100,'visa_received','paid','TEST',1)`, [reference]);
    await pool.execute('INSERT INTO operations_case_controls(application_id,assigned_staff_user_id) VALUES (?,?)', [app.insertId, staff[0]]);
    const [person] = await pool.execute<ResultSetHeader>("INSERT INTO applicants(application_id,applicant_index,full_name) VALUES (?,0,'Synthetic Delivery Traveller')", [app.insertId]);
    const [doc] = await pool.execute<ResultSetHeader>(`INSERT INTO documents
      (application_id,applicant_id,document_type,original_file_name,stored_file_name,mime_type,file_size,storage_path,upload_status)
      VALUES (?,?,'visa','synthetic.pdf','synthetic.pdf','application/pdf',10,'synthetic/never-a-real-file.pdf','uploaded')`, [app.insertId, person.insertId]);
    return { applicationId: app.insertId, applicationReference: reference, applicantId: person.insertId, visaDocumentId: doc.insertId,
      visaReference: 'SYNTHETIC-VISA', validitySummary: 'Synthetic validity', customerInstructions: ['Synthetic instructions'],
      commandId: randomUUID(), actorReference: `staff:${staff[0]}`, preparedAt: new Date().toISOString() };
  }
  async function syntheticScan(f: Awaited<ReturnType<typeof fixture>>, result: 'PASSED' | 'FAILED', time: string) {
    // This is simulated scan evidence ONLY in the disposable database, never a
    // substitute for an installed scanner or real staging acceptance.
    const scanId=randomUUID();
    await pool.execute(`INSERT INTO operations_document_security_scans
      (id,document_id,application_id,applicant_id,provider_code,provider_reference,engine_version,result,evidence_sha256,scanned_at,recorded_by)
      VALUES (?,?,?,?,'synthetic-ci',?,'fixture',?,?,?,'synthetic')`, [scanId, f.visaDocumentId, f.applicationId, f.applicantId, randomUUID(), result, 'a'.repeat(64), time]);
    if(result==='PASSED')await pool.execute("INSERT INTO operations_visa_file_evidence(scan_id,storage_path,content_sha256,byte_length,mime_type,engine_version,database_version,scanned_at) VALUES (?,?,?,10,'application/pdf','synthetic','1',?)",[scanId,`.visa-delivery-files/${randomUUID()}.pdf`,'a'.repeat(64),time]);
  }
  it('loads a case without a team and rechecks ownership inside the write transaction after reassignment', async () => {
    const f = await fixture();
    expect(await repository.context(f.applicationReference)).toMatchObject({ assignedActorId: `staff:${staff[0]}`, teamId: undefined, departmentId: undefined });
    await syntheticScan(f, 'PASSED', '2026-01-01');
    const actor = await access.refreshTrustedActor(f.actorReference);
    await pool.execute('UPDATE operations_case_controls SET assigned_staff_user_id=? WHERE application_id=?', [staff[1], f.applicationId]);
    await expect(repository.prepare(f)).rejects.toThrow('VISA_DELIVERY_ACCESS_DENIED');
    await expect(prepareSecureVisaDelivery({ ...f, actor, repository, flagContext: { environment: 'TEST' }, flags: [], now: new Date() })).rejects.toThrow('VISA_DELIVERY_ACCESS_DENIED');
    expect(await repository.listForCustomer(f.applicationReference)).toHaveLength(0);
  });
  it('never treats a missing or later failed scan as success', async () => {
    const f = await fixture();
    await expect(repository.prepare(f)).rejects.toThrow('VISA_DELIVERY_OWNERSHIP_OR_SCAN_REQUIRED');
    await syntheticScan(f, 'PASSED', '2026-01-01');
    await syntheticScan(f, 'FAILED', '2026-01-02');
    await expect(repository.prepare(f)).rejects.toThrow('VISA_DELIVERY_SCAN_NOT_PASSED');
    await syntheticScan(f, 'PASSED', '2026-01-02');
    await expect(repository.prepare(f)).rejects.toThrow('VISA_DELIVERY_SCAN_NOT_PASSED');
    expect(await repository.listForCustomer(f.applicationReference)).toHaveLength(0);
  });
  it('serializes concurrent retries, retains one delivery/audit, and rejects changed instructions or revoked grants', async () => {
    const f = await fixture();
    await syntheticScan(f, 'PASSED', '2026-01-01');
    f.preparedAt = '2026-10-10T19:59:19.765Z';
    const result = await Promise.all([repository.prepare(f), repository.prepare(f)]);
    expect(result[0].generatedAt).toBe('2026-10-10T19:59:19.000Z');
    expect(result[0]).toEqual(result[1]);
    expect(await repository.prepare({ ...f, commandId: randomUUID() })).toEqual(result[0]);
    expect(await repository.listForCustomer(f.applicationReference)).toEqual([result[0]]);
    const [audit] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) n FROM operations_audit_events WHERE event_type='VISA_DELIVERY_PREPARED' AND resource_reference=?", [result[0].deliveryId]);
    expect(Number(audit[0].n)).toBe(1);
    await expect(repository.prepare({ ...f, customerInstructions: ['Changed instructions'] })).rejects.toThrow('VISA_DELIVERY_IDEMPOTENCY_CONFLICT');
    await pool.execute("UPDATE applications SET status='completed' WHERE id=?", [f.applicationId]);
    expect(await repository.prepare(f)).toEqual(result[0]);
    await pool.execute('UPDATE operations_scope_grants SET revoked_at=UTC_TIMESTAMP() WHERE staff_user_id=?', [staff[0]]);
    await expect(repository.prepare(f)).rejects.toThrow('ACTOR_ACCESS_DENIED');
  });
  it('persists only the scanned byte snapshot and denies later failed scans or another customer', async () => {
    const f=await fixture(),root=await mkdtemp(path.join(os.tmpdir(),'tsh-db-visa-'));
    try {
      const bytes=Buffer.from('%PDF-1.7\nSynthetic CI visa only\n%%EOF');
      await writeFile(path.join(root,'visa.pdf'),bytes);
      await pool.execute("UPDATE documents SET storage_path='visa.pdf' WHERE id=?",[f.visaDocumentId]);
      let scans=0;
      const captured=new MysqlVisaDeliveryRepository(pool,sourcePath=>captureScannedVisaFile({storageRoot:root,sourcePath,scan:async()=>{scans++;return {outcome:'CLEAN',engineVersion:'synthetic-ci',databaseVersion:'1'};},now:()=>new Date('2026-10-10T00:00:00Z')}),evidence=>discardUncommittedVisaFile(root,evidence));
      const deliveries=await Promise.all([captured.prepare(f),captured.prepare(f)]);
      expect(deliveries[0]).toEqual(deliveries[1]);expect(scans).toBe(1);
      await writeFile(path.join(root,'visa.pdf'),'changed original');
      const record=await captured.documentForCustomer(f.applicationReference,deliveries[0].deliveryId);
      expect(record).not.toBeNull();
      expect(await readVerifiedVisaFile(root,record!.fileEvidence)).toEqual(bytes);
      expect(await captured.documentForCustomer('OTHER-CUSTOMER',deliveries[0].deliveryId)).toBeNull();
      expect((await captured.documentByArchivePath(record!.storagePath))?.applicationReference).toBe(f.applicationReference);
      const [scanRows]=await pool.execute<RowDataPacket[]>('SELECT id FROM operations_document_security_scans WHERE document_id=?',[f.visaDocumentId]);
      await expect(pool.execute("UPDATE operations_visa_file_evidence SET content_sha256=? WHERE scan_id=?",['b'.repeat(64),scanRows[0].id])).rejects.toMatchObject({sqlState:'45000'});
      await syntheticScan(f,'FAILED','2026-10-11');
      expect(await captured.documentForCustomer(f.applicationReference,deliveries[0].deliveryId)).toBeNull();
      expect(await captured.documentByArchivePath(record!.storagePath)).toBeNull();
    } finally {await rm(root,{recursive:true,force:true});}
  });
  it('never records a passed scan or delivery when the scanner is unavailable', async () => {
    const f=await fixture();
    const captured=new MysqlVisaDeliveryRepository(pool,async()=>{throw new Error('VISA_FILE_SCAN_UNAVAILABLE');});
    await expect(captured.prepare(f)).rejects.toThrow('VISA_FILE_SCAN_UNAVAILABLE');
    const [scans]=await pool.execute<RowDataPacket[]>('SELECT id FROM operations_document_security_scans WHERE document_id=?',[f.visaDocumentId]);
    expect(scans).toHaveLength(0);expect(await captured.listForCustomer(f.applicationReference)).toHaveLength(0);
  });
  it('refuses a historical passed result without byte-bound file evidence', async () => {
    const f=await fixture();
    await pool.execute(`INSERT INTO operations_document_security_scans(id,document_id,application_id,applicant_id,provider_code,provider_reference,engine_version,result,evidence_sha256,scanned_at,recorded_by) VALUES (?,?,?,?,'synthetic-ci',?,'fixture','PASSED',?,'2026-01-01','synthetic')`,[randomUUID(),f.visaDocumentId,f.applicationId,f.applicantId,randomUUID(),'a'.repeat(64)]);
    await expect(repository.prepare(f)).rejects.toThrow('VISA_DELIVERY_FILE_EVIDENCE_REQUIRED');
  });

});
