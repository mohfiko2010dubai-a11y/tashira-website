import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, type Pool, type ResultSetHeader } from 'mysql2/promise';
import type { AuthorizationActor } from './lib/authorization/policy';
import { listSupplierOperations } from './lib/supplier-operations';
const url = process.env.OPS_REHEARSAL_DATABASE_URL;
describe.skipIf(!url).sequential('supplier operations board in disposable MySQL', () => {
  let pool: Pool, owner: number, other: number, supplier: number;
  const tag = `BOARD-${randomUUID().slice(0, 8)}`;
  let actor: AuthorizationActor;
  const input = { search: tag, includeTest: true, offset: 0, limit: 30 };
  beforeAll(async () => {
    const target = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '33306' || !target.pathname.startsWith('/tashira_ops_rehearsal_')) throw new Error('Disposable database required');
    pool = createPool({ uri: url, connectionLimit: 4 });
    const [s] = await pool.execute<ResultSetHeader>("INSERT INTO suppliers(name,is_active) VALUES (?,'active')", [tag]); supplier = s.insertId;
    const createStaff = async (name: string) => { const [r] = await pool.execute<ResultSetHeader>("INSERT INTO staff_users(username,password_hash,name,is_active,staff_role) VALUES (?,'unusable','Synthetic Board Staff','active','staff')", [name]); return r.insertId; };
    owner = await createStaff(`${tag}-owner`); other = await createStaff(`${tag}-other`);
    actor = { id: `staff:${owner}`, permissions: new Set(['case.read_assigned', 'supplier.read_operational']), scopes: ['ASSIGNED'], teamIds: new Set(), departmentIds: new Set() };
  });
  afterAll(async () => { await pool?.end(); });
  async function fixture(staff = owner) {
    const [a] = await pool.execute<ResultSetHeader>(`INSERT INTO applications
      (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status,data_classification,is_test,supplier_id,supplier_cost_aed,supplier_vat_amount,supplier_total_aed)
      VALUES (?,'family','non-gcc','ROUTE_TEST','regular','board@example.invalid','000',1,100,'under_review','paid','TEST',1,?,100,5,105)`, [`${tag}-${randomUUID().slice(0, 8)}`, supplier]);
    await pool.execute('INSERT INTO operations_case_controls(application_id,assigned_staff_user_id) VALUES (?,?)', [a.insertId, staff]);
    const people: number[] = [];
    for (let index = 0; index < 2; index++) { const [p] = await pool.execute<ResultSetHeader>("INSERT INTO applicants(application_id,applicant_index,full_name) VALUES (?,?,'Synthetic Board Traveller')", [a.insertId, index]); people.push(p.insertId); }
    return { id: a.insertId, people };
  }
  async function document(id: number, person: number | null, type = 'visa') {
    const [d] = await pool.execute<ResultSetHeader>(`INSERT INTO documents(application_id,applicant_id,document_type,original_file_name,stored_file_name,mime_type,file_size,storage_path,upload_status)
      VALUES (?,?,?,'synthetic.pdf','synthetic.pdf','application/pdf',10,'synthetic/never-a-real-file.pdf','uploaded')`, [id, person, type]); return d.insertId;
  }
  it('scopes counts and rows together and never selects employee accounting fields', async () => {
    const own = await fixture(); await fixture(other);
    const rows = await listSupplierOperations(input, actor, false, pool);
    expect(rows.items.map(row => row.applicationId)).toEqual([own.id]);
    expect(rows.counts).toEqual({ SELECTED: 1 }); expect(rows.items[0]).not.toHaveProperty('accounting');
    expect(JSON.stringify(rows)).not.toMatch(/supplierCost|supplierVat|supplierTotal/);
    expect(Object.keys(rows.items[0]).sort()).toEqual(['applicationId','reference','supplierId','supplierName','product','status','stage','applicantCount','visaCount','supplierSentAt','authorityFiledAt','followUpAt','externalReference','isTest'].sort());
    expect((await listSupplierOperations({ ...input, includeTest: false }, actor, false, pool)).items).toEqual([]);
    await expect(listSupplierOperations(input, { ...actor, permissions: new Set(['case.read_assigned']) }, false, pool)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const manager = { ...actor, scopes: ['ALL'] as const };
    const admin = await listSupplierOperations(input, manager, true, pool);
    expect(admin.items).toHaveLength(2); expect(admin.items[0].accounting).toMatchObject({ supplierCostAed: '100.00', supplierVatAmount: '5.00', supplierTotalAed: '105.00' });
  });
  it('requires visa files for every traveller and does not multiply rows for duplicate uploads', async () => {
    const f = await fixture(); await pool.execute("UPDATE applications SET status='visa_received' WHERE id=?", [f.id]);
    await document(f.id, f.people[0]); await document(f.id, f.people[0]);
    const find = async () => (await listSupplierOperations(input, actor, false, pool)).items.find(row => row.applicationId === f.id)!;
    expect(await find()).toMatchObject({ stage: 'REVIEW', visaCount: 1, applicantCount: 2 });
    await document(f.id, f.people[1]); expect(await find()).toMatchObject({ stage: 'VISAS_READY', visaCount: 2 });
    await pool.execute("UPDATE applications SET status='cancelled' WHERE id=?", [f.id]); expect(await find()).toMatchObject({ stage: 'CLOSED' });
  });
  it('distinguishes supplier dispatch from authority filing and ignores stale supplier/product evidence', async () => {
    const f = await fixture(); const source = await document(f.id, null, 'supporting');
    const record = async (kind: string, quantity = 2) => { const copy = await document(f.id, null, 'supporting'); await pool.execute(`INSERT INTO operations_submission_evidence
      (id,application_id,supplier_id,evidence_kind,external_reference,source_document_id,document_id,content_sha256,service_code,applicant_quantity,occurred_at,command_hash,actor_reference)
      VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3),?,'synthetic')`, [randomUUID(), f.id, supplier, kind, 'SYNTHETIC-REF', source, copy, 'a'.repeat(64), 'ROUTE_TEST', quantity, 'b'.repeat(64)]); };
    await record('SUPPLIER_SENT');
    const find = async () => (await listSupplierOperations(input, actor, false, pool)).items.find(row => row.applicationId === f.id)!;
    expect(await find()).toMatchObject({ stage: 'SENT', authorityFiledAt: null, externalReference: 'SYNTHETIC-REF' });
    await record('AUTHORITY_FILED', 1); expect(await find()).toMatchObject({ stage: 'SENT' });
    await record('AUTHORITY_FILED'); expect(await find()).toMatchObject({ stage: 'FILED' });
    await pool.execute("UPDATE applications SET visa_type='NEW_PRODUCT' WHERE id=?", [f.id]); expect(await find()).toMatchObject({ stage: 'SELECTED', externalReference: null });
    const page = await listSupplierOperations({ ...input, limit: 1 }, actor, false, pool);
    expect(page.items).toHaveLength(1); expect(Object.values(page.counts).reduce((a, b) => a + b, 0)).toBe(3);
  });
});
