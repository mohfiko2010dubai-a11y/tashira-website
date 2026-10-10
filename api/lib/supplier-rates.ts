import { TRPCError } from '@trpc/server';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { aedAmount, aedMinorUnits, supplierRateInput, supplierVatStatus, supplierPlaceOfSupply, type SupplierRateInput } from '../../contracts/supplier-rates';
import { defaultOperationsPool } from './operations/mysql-query-client';

export async function listSupplierRates(supplierId: number, pool: Pool = defaultOperationsPool()) {
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT r.* FROM supplier_product_rates r
    WHERE r.supplier_id=? AND NOT EXISTS (SELECT 1 FROM supplier_product_rates newer
      WHERE newer.supplier_id=r.supplier_id AND newer.service_code=r.service_code
      AND newer.processing_type=r.processing_type AND newer.version>r.version)
    ORDER BY r.service_code,r.processing_type`, [supplierId]);
  return rows.map(row => ({ id: Number(row.id), serviceCode: String(row.service_code), processingType: String(row.processing_type) as 'regular' | 'express',
    version: Number(row.version), costAed: String(row.cost_aed), vatAmountAed: String(row.vat_amount_aed), totalAed: String(row.total_aed),
    vatStatus: supplierVatStatus.parse(row.vat_status), placeOfSupply: supplierPlaceOfSupply.parse(row.place_of_supply),
    active: Boolean(row.active), reason: String(row.reason), createdBy: String(row.created_by) }));
}

export async function saveSupplierRate(raw: SupplierRateInput, actor: string, pool: Pool = defaultOperationsPool()) {
  const input = supplierRateInput.parse(raw);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // The supplier row serializes even first-ever inserts for a product/speed.
    const [suppliers] = await connection.execute<RowDataPacket[]>('SELECT is_active FROM suppliers WHERE id=? FOR UPDATE', [input.supplierId]);
    if (suppliers[0]?.is_active !== 'active') throw new TRPCError({ code: 'BAD_REQUEST', message: 'المورد غير نشط. فعّل المورد قبل تعديل قائمة أسعاره.' });
    const [products] = await connection.execute<RowDataPacket[]>('SELECT service_code FROM visa_product_availability WHERE service_code=?', [input.serviceCode]);
    if (!products.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المنتج غير موجود. اختر منتجًا من قائمة التأشيرات.' });
    const [versions] = await connection.execute<RowDataPacket[]>('SELECT version FROM supplier_product_rates WHERE supplier_id=? AND service_code=? AND processing_type=? ORDER BY version DESC LIMIT 1', [input.supplierId, input.serviceCode, input.processingType]);
    const version = Number(versions[0]?.version ?? 0);
    if (version !== input.expectedVersion) throw new TRPCError({ code: 'CONFLICT', message: 'تم تحديث السعر بواسطة مستخدم آخر. حدّث القائمة وراجع السعر قبل الحفظ.' });
    const total = aedAmount(aedMinorUnits(input.costAed) + aedMinorUnits(input.vatAmountAed));
    await connection.execute(`INSERT INTO supplier_product_rates
      (supplier_id,service_code,processing_type,version,cost_aed,vat_amount_aed,total_aed,vat_status,place_of_supply,active,reason,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [input.supplierId, input.serviceCode, input.processingType, version + 1, input.costAed, input.vatAmountAed,
      total, input.vatStatus, input.placeOfSupply, input.active, input.reason, actor]);
    await connection.commit();
    return { saved: true as const, version: version + 1 };
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
