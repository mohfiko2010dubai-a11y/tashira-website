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
    await pool.execute(`INSERT INTO operations_document_security_scans
      (id,document_id,application_id,applicant_id,provider_code,provider_reference,engine_version,result,evidence_sha256,scanned_at,recorded_by)
      VALUES (?,?,?,?,'synthetic-ci',?,'fixture',?,?,?,'synthetic')`, [randomUUID(), f.visaDocumentId, f.applicationId, f.applicantId, randomUUID(), result, 'a'.repeat(64), time]);
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
    const result = await Promise.all([repository.prepare(f), repository.prepare(f)]);
    expect(result[0]).toEqual(result[1]);
    expect(await repository.prepare({ ...f, commandId: randomUUID() })).toEqual(result[0]);
    expect(await repository.listForCustomer(f.applicationReference)).toHaveLength(1);
    const [audit] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) n FROM operations_audit_events WHERE event_type='VISA_DELIVERY_PREPARED' AND resource_reference=?", [result[0].deliveryId]);
    expect(Number(audit[0].n)).toBe(1);
    await expect(repository.prepare({ ...f, customerInstructions: ['Changed instructions'] })).rejects.toThrow('VISA_DELIVERY_IDEMPOTENCY_CONFLICT');
    await pool.execute("UPDATE applications SET status='completed' WHERE id=?", [f.applicationId]);
    expect(await repository.prepare(f)).toEqual(result[0]);
    await pool.execute('UPDATE operations_scope_grants SET revoked_at=UTC_TIMESTAMP() WHERE staff_user_id=?', [staff[0]]);
    await expect(repository.prepare(f)).rejects.toThrow('VISA_DELIVERY_ACCESS_DENIED');
  });
});
