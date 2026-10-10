import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { listSupplierRates, saveSupplierRate } from './lib/supplier-rates';

const url = process.env.OPS_REHEARSAL_DATABASE_URL;
describe.skipIf(!url)('supplier rate versions in disposable MySQL', () => {
  let pool: Pool, supplierId: number;
  const serviceCode = `RATE-${randomUUID()}`;
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
});
