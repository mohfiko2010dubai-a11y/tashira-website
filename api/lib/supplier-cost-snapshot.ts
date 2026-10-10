import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { TRPCError } from '@trpc/server';
import { aedAmount, aedMinorUnits } from '../../contracts/supplier-rates';

export type SupplierCostStatus = 'READY' | 'MISSING_RATE' | 'MANUAL_REVIEW';
export function supplierTotals(cost: string, vat: string, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'لا توجد بيانات مسافرين مكتملة لحساب التكلفة. أضف المسافرين ثم احفظ المورد.' });
  const net = aedMinorUnits(cost) * quantity, tax = aedMinorUnits(vat) * quantity;
  if (!Number.isSafeInteger(net + tax) || net + tax > 9999999999) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'التكلفة تتجاوز الحد المسموح. راجع عدد المسافرين وسعر المورد مع المدير.' });
  return { cost: aedAmount(net), vat: aedAmount(tax), total: aedAmount(net + tax) };
}

/** Automatic unbilled estimates may be replaced; historical/manual financial entries may not. */
export async function canReplaceSupplierEstimate(connection: PoolConnection, row: RowDataPacket) {
  if (row.supplier_invoice_number || row.supplier_paid === 'paid') return false;
  const hasCost = [row.supplier_cost_aed, row.supplier_vat_amount, row.supplier_total_aed].some(value => value != null);
  if (!hasCost) return true;
  if (!row.supplier_rate_id || !row.supplier_rate_quantity) return false;
  const [rates] = await connection.execute<RowDataPacket[]>('SELECT supplier_id,cost_aed,vat_amount_aed,vat_status,place_of_supply FROM supplier_product_rates WHERE id=?', [row.supplier_rate_id]);
  const rate = rates[0];
  if (!rate || Number(rate.supplier_id) !== Number(row.supplier_id)) return false;
  const totals = supplierTotals(String(rate.cost_aed), String(rate.vat_amount_aed), Number(row.supplier_rate_quantity));
  return totals.cost === String(row.supplier_cost_aed) && totals.vat === String(row.supplier_vat_amount) && totals.total === String(row.supplier_total_aed)
    && row.supplier_vat_status === rate.vat_status && row.supplier_place_of_supply === rate.place_of_supply;
}

export async function captureSupplierCost(connection: PoolConnection, applicationId: number, supplierId: number, product: string, speed: string, quantity: number): Promise<SupplierCostStatus> {
  // Caller already holds the application and supplier locks. Do not fall back past a disabled latest rate.
  const [rates] = await connection.execute<RowDataPacket[]>(`SELECT id,cost_aed,vat_amount_aed,vat_status,place_of_supply,active
    FROM supplier_product_rates WHERE supplier_id=? AND service_code=? AND processing_type=? ORDER BY version DESC LIMIT 1`, [supplierId, product, speed]);
  const rate = rates[0];
  if (!rate?.active || quantity < 1) {
    await connection.execute(`UPDATE applications SET supplier_id=?,supplier_rate_id=NULL,supplier_rate_quantity=NULL,
      supplier_cost_aed=NULL,supplier_vat_amount=NULL,supplier_total_aed=NULL,supplier_vat_status=NULL,supplier_place_of_supply=NULL WHERE id=?`, [supplierId, applicationId]);
    return 'MISSING_RATE';
  }
  const totals = supplierTotals(String(rate.cost_aed), String(rate.vat_amount_aed), quantity);
  await connection.execute(`UPDATE applications SET supplier_id=?,supplier_rate_id=?,supplier_rate_quantity=?,
    supplier_cost_aed=?,supplier_vat_amount=?,supplier_total_aed=?,supplier_vat_status=?,supplier_place_of_supply=? WHERE id=?`,
  [supplierId, rate.id, quantity, totals.cost, totals.vat, totals.total, rate.vat_status, rate.place_of_supply, applicationId]);
  return 'READY';
}
