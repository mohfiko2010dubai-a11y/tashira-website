import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { refundRouter } from './refund-router';
import { env } from './lib/env';
import type { TrpcContext } from './context';
const url = process.env.OPS_REHEARSAL_DATABASE_URL;
describe.skipIf(!url).sequential('refund request retries in disposable MySQL', () => {
  let pool: Pool;
  const staff: number[] = [];
  const context = (id: number): TrpcContext => ({ staffId: id, isAdmin: false, req: new Request('https://example.invalid'), resHeaders: new Headers(), customerApplicationReferences: new Set() });
  beforeAll(async () => {
    const target = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '33306' || !target.pathname.startsWith('/tashira_ops_rehearsal_')) throw new Error('Disposable database required');
    if (env.databaseUrl !== url) throw new Error('Router database must be the same disposable rehearsal database');
    pool = createPool({ uri: url, connectionLimit: 4 });
    const tag = randomUUID().slice(0, 8);
    const [role] = await pool.execute<ResultSetHeader>('INSERT INTO operations_roles(code,name) VALUES (?,?)', [`REF_${tag}`, `Refund ${tag}`]);
    for (const code of ['case.read_assigned', 'case.transition']) await pool.execute("INSERT INTO operations_role_permissions(role_id,permission_id,granted_by) SELECT ?,id,'synthetic' FROM operations_permissions WHERE code=?", [role.insertId, code]);
    for (let i = 0; i < 2; i++) {
      const [p] = await pool.execute<ResultSetHeader>("INSERT INTO staff_users(username,password_hash,name,is_active,staff_role) VALUES (?,'unusable','Synthetic Refund Staff','active','staff')", [`refund-${tag}-${i}`]); staff.push(p.insertId);
      await pool.execute("INSERT INTO operations_staff_roles(staff_user_id,role_id,granted_by,valid_from) VALUES (?,?,'synthetic',UTC_TIMESTAMP())", [p.insertId, role.insertId]);
      await pool.execute("INSERT INTO operations_scope_grants(staff_user_id,scope_type,granted_by) VALUES (?,'ASSIGNED','synthetic')", [p.insertId]);
    }
  });
  afterAll(async () => { await pool?.end(); });
  async function fixture() {
    const [a] = await pool.execute<ResultSetHeader>(`INSERT INTO applications(reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status,data_classification,is_test)
      VALUES (?,'single','non-gcc','ROUTE_TEST','regular','refund@example.invalid','000',1,100,'under_review','paid','TEST',1)`, [`REF-${randomUUID()}`]);
    await pool.execute('INSERT INTO operations_case_controls(application_id,assigned_staff_user_id) VALUES (?,?)', [a.insertId, staff[0]]);
    const payments: number[] = [];
    for (let i = 0; i < 2; i++) { const [p] = await pool.execute<ResultSetHeader>("INSERT INTO payments(application_id,stripe_payment_intent_id,amount,currency,status) VALUES (?,?,100,'USD','succeeded')", [a.insertId, `pi_synthetic_${randomUUID()}`]); payments.push(p.insertId); }
    return { id: a.insertId, payments };
  }
  function command(f: Awaited<ReturnType<typeof fixture>>) { return { commandId: randomUUID(), applicationId: f.id, reason: 'Synthetic refund request', policyVersion: 'synthetic-test', items: [{ sourceType: 'VISA_SERVICE' as const, paymentId: f.payments[0], requestedAmount: 10, deduction: { type: 'NONE' as const } }] }; }
  it('creates one case, reservation and event for concurrent and lost-response retries', async () => {
    const f = await fixture(), request = command(f), caller = refundRouter.createCaller(context(staff[0]));
    await expect(caller.createCase({ ...request, commandId: undefined })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await caller.listByApplication({ applicationId: f.id })).toEqual([]);
    const results = await Promise.all([caller.createCase(request), caller.createCase(request)]);
    expect(results.map(r => r.refundCaseId)).toEqual([request.commandId, request.commandId]);
    expect(results.filter(r => r.replayed)).toHaveLength(1);
    await expect(caller.createCase({ ...request, reason: 'Changed intent' })).rejects.toMatchObject({ code: 'CONFLICT' });
    const [counts] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) n FROM refund_items WHERE refund_case_id=?', [request.commandId]); expect(Number(counts[0].n)).toBe(1);
    const [events] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) n FROM financial_events WHERE source_reference=? AND financial_event_type='REFUND_REQUESTED'", [request.commandId]); expect(Number(events[0].n)).toBe(1);
    const sources = await caller.eligibleSources({ applicationId: f.id }); expect(sources.find(s => s.id === f.payments[0])?.availableAmount).toBe(90);
    await pool.execute('UPDATE payments SET amount=0.30 WHERE id=?', [f.payments[1]]);
    for (const requestedAmount of [0.10, 0.20]) await caller.createCase({ ...request, commandId: randomUUID(), items: [{ ...request.items[0], paymentId: f.payments[1], requestedAmount }] });
    expect((await caller.eligibleSources({ applicationId: f.id })).find(s => s.id === f.payments[1])?.availableAmount).toBe(0);
    await pool.execute("UPDATE refund_cases SET refund_case_status='APPROVED' WHERE id=?", [request.commandId]);
    expect(await caller.createCase(request)).toMatchObject({ refundCaseId: request.commandId, status: 'APPROVED', replayed: true });
  });
  it('supports another visa payment and a deposit without moving any money', async () => {
    const f = await fixture(), caller = refundRouter.createCaller(context(staff[0]));
    const requestId = randomUUID(), depositId = randomUUID();
    await pool.execute(`INSERT INTO security_deposit_requests(id,application_id,amount,currency,security_deposit_status,purpose,access_token_hash,expires_at,requested_by)
      VALUES (?,?,50,'AED','PAID','Synthetic deposit',?,'2030-01-01','synthetic')`, [requestId, f.id, randomUUID().replaceAll('-', '').padEnd(64, '0')]);
    await pool.execute("INSERT INTO security_deposit_payments(id,request_id,stripe_payment_intent_id,amount,currency,security_deposit_payment_status) VALUES (?,?,?,50,'AED','SUCCEEDED')", [depositId, requestId, `pi_synthetic_${randomUUID()}`]);
    const request = command(f); request.items[0].paymentId = f.payments[1]; await caller.createCase(request);
    const deposit = await caller.createCase({ ...request, commandId: randomUUID(), items: [{ sourceType: 'SECURITY_DEPOSIT', securityDepositPaymentId: depositId, requestedAmount: 20, deduction: { type: 'NONE' } }] });
    const cases = await caller.listByApplication({ applicationId: f.id }); expect(cases).toHaveLength(2);
    expect(cases.find(c => c.id === deposit.refundCaseId)?.items[0]).toMatchObject({ sourceType: 'SECURITY_DEPOSIT', securityDepositPaymentId: depositId, status: 'PENDING' });
    const available = await caller.eligibleSources({ applicationId: f.id }); expect(available.find(s => s.id === depositId)?.availableAmount).toBe(30);
  });
  it('denies a prior owner retry and refuses another applications payment', async () => {
    const f = await fixture(), foreign = await fixture(), caller = refundRouter.createCaller(context(staff[0])), request = command(f);
    await expect(caller.createCase({ ...request, items: [{ ...request.items[0], paymentId: foreign.payments[0] }] })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await caller.listByApplication({ applicationId: f.id })).toEqual([]);
    await caller.createCase(request);
    await pool.execute('UPDATE operations_case_controls SET assigned_staff_user_id=? WHERE application_id=?', [staff[1], f.id]);
    await expect(caller.createCase(request)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(refundRouter.createCaller(context(staff[1])).createCase(request)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
