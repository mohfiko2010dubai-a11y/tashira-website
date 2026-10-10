import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { TRPCError } from '@trpc/server';
import { withCheckoutLock } from './checkout-quote';
import { canReplaceSupplierEstimate, captureSupplierCost, type SupplierCostStatus } from './supplier-cost-snapshot';

export async function selectCaseSupplier(applicationId: number, supplierId: number, expectedSupplierId: number | null, actor: string, requiredOwnerId?: number) {
  return withCheckoutLock(applicationId, async connection => {
    const [rows] = await connection.execute<RowDataPacket[]>(`SELECT a.status,a.supplier_id,a.supplier_cost_aed,a.supplier_vat_amount,a.supplier_total_aed,a.supplier_invoice_number,a.supplier_paid,
      a.supplier_vat_status,a.supplier_place_of_supply,a.supplier_rate_id,a.supplier_rate_quantity,COALESCE(a.submitted_product,a.visa_type) product,a.processing_type,
      r.service_code captured_product,r.processing_type captured_speed,
      (SELECT COUNT(*) FROM applicants p WHERE p.application_id=a.id) quantity
      FROM applications a LEFT JOIN supplier_product_rates r ON r.id=a.supplier_rate_id WHERE a.id=?`, [applicationId]);
    const row = rows[0];
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'الطلب غير موجود. ارجع إلى قائمة الطلبات.' });
    if (requiredOwnerId !== undefined) {
      const [owners] = await connection.execute<RowDataPacket[]>('SELECT assigned_staff_user_id FROM operations_case_controls WHERE application_id=? FOR UPDATE', [applicationId]);
      if (Number(owners[0]?.assigned_staff_user_id) !== requiredOwnerId) throw new TRPCError({ code: 'FORBIDDEN', message: 'الطلب لم يعد مسندًا إليك. حدّث قائمة العمل.' });
    }
    const current = row.supplier_id == null ? null : Number(row.supplier_id);
    const matchingSnapshot = row.supplier_rate_id && row.product === row.captured_product && row.processing_type === row.captured_speed && Number(row.quantity) === Number(row.supplier_rate_quantity);
    if (current === supplierId && (matchingSnapshot || row.supplier_invoice_number || row.supplier_paid === 'paid')) return { saved: true as const, pricingReadiness: matchingSnapshot ? 'READY' as const : 'MANUAL_REVIEW' as const };
    if (current !== supplierId && current !== expectedSupplierId) throw new TRPCError({ code: 'CONFLICT', message: 'تغير المورد بواسطة مستخدم آخر. حدّث الطلب ثم راجع الاختيار.' });
    if (['visa_processing', 'visa_received', 'completed', 'cancelled', 'rejected'].includes(row.status)) throw new TRPCError({ code: 'CONFLICT', message: 'بدأ تقديم الطلب أو أُغلق. راجع المدير قبل تغيير جهة التقديم.' });
    // Never attach an existing supplier's financial entries to a different supplier.
    if (!await canReplaceSupplierEstimate(connection, row)) {
      if (current === supplierId) return { saved: true as const, pricingReadiness: 'MANUAL_REVIEW' as SupplierCostStatus };
      throw new TRPCError({ code: 'CONFLICT', message: 'توجد بيانات مالية للمورد الحالي. اطلب من المدير مراجعتها قبل تغيير المورد.' });
    }
    const [suppliers] = await connection.execute<RowDataPacket[]>("SELECT id FROM suppliers WHERE id=? AND is_active='active' FOR UPDATE", [supplierId]);
    if (!suppliers.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المورد غير متاح. حدّث القائمة واختر موردًا نشطًا.' });
    const pricingReadiness = await captureSupplierCost(connection, applicationId, supplierId, String(row.product), String(row.processing_type), Number(row.quantity));
    if (current === supplierId && pricingReadiness === 'MISSING_RATE' && row.supplier_cost_aed == null) return { saved: true as const, pricingReadiness };
    await connection.execute('INSERT INTO application_timeline_events (id,application_id,event_name,event_source,actor_type,actor_reference,summary) VALUES (?,?,\'SUPPLIER_SELECTED\',\'STAFF_DESK\',?,?,?)', [randomUUID(), applicationId, requiredOwnerId === undefined ? 'ADMIN' : 'STAFF', actor, `Supplier ${current ?? 'none'} -> ${supplierId}`]);
    return { saved: true as const, pricingReadiness };
  });
}
