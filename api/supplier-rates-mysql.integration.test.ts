import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { listSupplierRates, saveSupplierRate } from './lib/supplier-rates';
import { selectCaseSupplier } from './lib/supplier-selection';

const url = process.env.OPS_REHEARSAL_DATABASE_URL;
describe.skipIf(!url)('supplier rate versions in disposable MySQL', () => {
  let pool: Pool, supplierId: number;
  const serviceCode = `RATE-${randomUUID()}`;
  let applicationId: number;
  const rate = () => ({ supplierId, serviceCode, processingType: 'regular' as const, expectedVersion: 0, costAed: '100.10', vatAmountAed: '5.01',
    vatStatus: 'standard' as const, placeOfSupply: 'within_uae' as const, active: true, reason: 'Synthetic approved rate' });
  beforeAll(async () => {
    const target = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '33306' || !target.pathname.startsWith('/tashira_ops_rehearsal_')) throw new Error('Disposable database required');
    pool = createPool({ uri: url, connectionLimit: 4 });
    const [created] = await pool.execute<ResultSetHeader>("INSERT INTO suppliers(name,is_active) VALUES (?,'active')", [`Synthetic rates ${serviceCode}`]);
    supplierId = created.insertId;
    await pool.execute('INSERT INTO visa_product_availability(service_code,is_active) VALUES (?,1)', [serviceCode]);
  });
  afterAll(async () => { await pool?.end(); });
  it('serializes simultaneous first prices and preserves exactly one version', async () => {
    const results = await Promise.allSettled([saveSupplierRate(rate(), 'synthetic:a', pool), saveSupplierRate(rate(), 'synthetic:b', pool)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'CONFLICT' } });
    expect(await listSupplierRates(supplierId, pool)).toMatchObject([{ version: 1, totalAed: '105.11', active: true }]);
  });
  it('versions regular/express independently; stopping a rate never falls back to its older active price', async () => {
    await saveSupplierRate({ ...rate(), expectedVersion: 1, active: false, reason: 'Supplier stopped this offer' }, 'synthetic:admin', pool);
    await saveSupplierRate({ ...rate(), processingType: 'express', costAed: '150', vatAmountAed: '0', vatStatus: 'out_of_scope' }, 'synthetic:admin', pool);
    const rows = await listSupplierRates(supplierId, pool);
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.processingType === 'regular')).toMatchObject({ version: 2, active: false });
    expect(rows.find(row => row.processingType === 'express')).toMatchObject({ version: 1, totalAed: '150.00', active: true });
    const [history] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) n FROM supplier_product_rates WHERE supplier_id=?', [supplierId]);
    expect(Number(history[0].n)).toBe(3);
  });
  it('rejects unknown products, invalid VAT and mutation/deletion of history without partial rows', async () => {
    await expect(saveSupplierRate({ ...rate(), serviceCode: 'missing-synthetic-product' }, 'synthetic', pool)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(saveSupplierRate({ ...rate(), expectedVersion: 2, vatStatus: 'exempt' }, 'synthetic', pool)).rejects.toThrow();
    await expect(pool.execute('UPDATE supplier_product_rates SET cost_aed=0 WHERE supplier_id=?', [supplierId])).rejects.toMatchObject({ sqlState: '45000' });
    await expect(pool.execute('DELETE FROM supplier_product_rates WHERE supplier_id=?', [supplierId])).rejects.toMatchObject({ sqlState: '45000' });
    const [history] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) n FROM supplier_product_rates WHERE supplier_id=?', [supplierId]);
    expect(Number(history[0].n)).toBe(3);
  });
  it('captures a two-traveller estimate on selection without changing payment, visa or assignment', async () => {
    const [created] = await pool.execute<ResultSetHeader>(`INSERT INTO applications
      (reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status,data_classification,is_test)
      VALUES (?,'family','non-gcc',?,'express','supplier@example.invalid','000',1,900,'under_review','paid','TEST',1)`, [`SUP-${randomUUID()}`, serviceCode]);
    applicationId = created.insertId;
    for (let index = 0; index < 2; index++) await pool.execute("INSERT INTO applicants(application_id,applicant_index,full_name) VALUES (?,?,'Synthetic Supplier Traveller')", [applicationId, index]);
    expect(await selectCaseSupplier(applicationId, supplierId, null, 'synthetic:admin')).toEqual({ saved: true, pricingReadiness: 'READY' });
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT supplier_cost_aed,supplier_total_aed,supplier_rate_quantity,status,payment_status FROM applications WHERE id=?', [applicationId]);
    expect(rows[0]).toMatchObject({ supplier_cost_aed: '300.00', supplier_total_aed: '300.00', supplier_rate_quantity: 2, status: 'under_review', payment_status: 'paid' });
  });
  it('does not reprice or duplicate the audit on retries after a supplier rate update', async () => {
    await saveSupplierRate({ ...rate(), processingType: 'express', expectedVersion: 1, costAed: '155', vatAmountAed: '0', vatStatus: 'out_of_scope' }, 'synthetic:admin', pool);
    expect(await selectCaseSupplier(applicationId, supplierId, null, 'synthetic:admin')).toEqual({ saved: true, pricingReadiness: 'READY' });
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT supplier_total_aed FROM applications WHERE id=?', [applicationId]);
    expect(rows[0].supplier_total_aed).toBe('300.00');
    const [events] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) n FROM application_timeline_events WHERE application_id=? AND event_name='SUPPLIER_SELECTED'", [applicationId]);
    expect(Number(events[0].n)).toBe(1);
  });
  it('refreshes an unbilled automatic estimate when the traveller count changes; never overwrites a booked supplier', async () => {
    await pool.execute("INSERT INTO applicants(application_id,applicant_index,full_name) VALUES (?,2,'Synthetic Third Traveller')", [applicationId]);
    await selectCaseSupplier(applicationId, supplierId, supplierId, 'synthetic:admin');
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT supplier_total_aed,supplier_rate_quantity FROM applications WHERE id=?', [applicationId]);
    expect(rows[0]).toMatchObject({ supplier_total_aed: '465.00', supplier_rate_quantity: 3 });
    await pool.execute("UPDATE applications SET supplier_invoice_number='SYNTHETIC-BOOKED' WHERE id=?", [applicationId]);
    const [other] = await pool.execute<ResultSetHeader>("INSERT INTO suppliers(name,is_active) VALUES ('Synthetic other supplier','active')");
    await expect(selectCaseSupplier(applicationId, other.insertId, supplierId, 'synthetic:admin')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
