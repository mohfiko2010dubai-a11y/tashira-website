import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ pool: undefined as Pool | undefined }));
vi.mock('./operations/mysql-query-client', () => ({ defaultOperationsPool: () => state.pool }));
import { selectCaseSupplier } from './supplier-selection';
const integration = process.env.OPS_READ_DATABASE_URL ? describe.sequential : describe.skip;
integration('supplier selection MySQL transaction', () => {
  let applicationId = 0;
  const supplierIds: number[] = [];
  beforeAll(async () => {
    state.pool = createPool({ uri: process.env.OPS_READ_DATABASE_URL, connectionLimit: 3 });
    for (const name of ['Synthetic selection A', 'Synthetic selection B']) {
      const [result] = await state.pool.execute<ResultSetHeader>("INSERT INTO suppliers (name,is_active) VALUES (?,'active')", [name]);
      supplierIds.push(result.insertId);
    }
    const [result] = await state.pool.execute<ResultSetHeader>(`INSERT INTO applications
      (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,total_amount_usd,status,payment_status,data_classification)
      VALUES (?,'single','gcc-resident','30days-single','regular','synthetic@example.invalid','000',3.67,678.95,185,'under_review','paid','TEST')`, [`TSH-SUP-${Date.now()}`]);
    applicationId = result.insertId;
  });
  // Keep immutable audit evidence in the disposable integration database.
  afterAll(async () => { await state.pool?.end(); });
  it('concurrent saves have one winner and exactly one audit event', async () => {
    const results = await Promise.allSettled(supplierIds.map(id => selectCaseSupplier(applicationId, id, null, 'synthetic-admin')));
    expect(results.filter(result => result.status === 'fulfilled'), results.filter(result => result.status === 'rejected').map(result => String(result.reason)).join('; ')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const [rows] = await state.pool!.execute<RowDataPacket[]>('SELECT supplier_id,supplier_cost_aed,status FROM applications WHERE id=?', [applicationId]);
    expect(supplierIds).toContain(Number(rows[0].supplier_id));
    expect(rows[0].supplier_cost_aed).toBeNull();
    expect(rows[0].status).toBe('under_review');
    await selectCaseSupplier(applicationId, Number(rows[0].supplier_id), null, 'synthetic-admin');
    const [events] = await state.pool!.execute<RowDataPacket[]>("SELECT actor_reference FROM application_timeline_events WHERE application_id=? AND event_name='SUPPLIER_SELECTED'", [applicationId]);
    expect(events).toHaveLength(1);
    expect(events[0].actor_reference).toBe('synthetic-admin');
  });
});
