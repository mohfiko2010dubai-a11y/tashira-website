import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { TRPCError } from '@trpc/server';
import { withCheckoutLock } from './checkout-quote';

export async function selectCaseSupplier(applicationId: number, supplierId: number, expectedSupplierId: number | null, actor: string, requiredOwnerId?: number) {
  return withCheckoutLock(applicationId, async connection => {
    const [rows] = await connection.execute<RowDataPacket[]>('SELECT status,supplier_id,supplier_cost_aed,supplier_vat_amount,supplier_total_aed,supplier_invoice_number,supplier_paid FROM applications WHERE id=?', [applicationId]);
    const row = rows[0];
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'الطلب غير موجود. ارجع إلى قائمة الطلبات.' });
    if (requiredOwnerId !== undefined) {
      const [owners] = await connection.execute<RowDataPacket[]>('SELECT assigned_staff_user_id FROM operations_case_controls WHERE application_id=? FOR UPDATE', [applicationId]);
      if (Number(owners[0]?.assigned_staff_user_id) !== requiredOwnerId) throw new TRPCError({ code: 'FORBIDDEN', message: 'الطلب لم يعد مسندًا إليك. حدّث قائمة العمل.' });
    }
    const current = row.supplier_id == null ? null : Number(row.supplier_id);
    if (current === supplierId) return { saved: true as const };
    if (current !== expectedSupplierId) throw new TRPCError({ code: 'CONFLICT', message: 'تغير المورد بواسطة مستخدم آخر. حدّث الطلب ثم راجع الاختيار.' });
    if (['visa_processing', 'visa_received', 'completed', 'cancelled', 'rejected'].includes(row.status)) throw new TRPCError({ code: 'CONFLICT', message: 'بدأ تقديم الطلب أو أُغلق. راجع المدير قبل تغيير جهة التقديم.' });
    // Never attach an existing supplier's financial entries to a different supplier.
    if (row.supplier_invoice_number || row.supplier_paid === 'paid' || [row.supplier_cost_aed, row.supplier_vat_amount, row.supplier_total_aed].some(value => value != null)) throw new TRPCError({ code: 'CONFLICT', message: 'توجد بيانات مالية للمورد الحالي. اطلب من المدير مراجعتها قبل تغيير المورد.' });
    const [suppliers] = await connection.execute<RowDataPacket[]>("SELECT id FROM suppliers WHERE id=? AND is_active='active' FOR UPDATE", [supplierId]);
    if (!suppliers.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'المورد غير متاح. حدّث القائمة واختر موردًا نشطًا.' });
    await connection.execute('UPDATE applications SET supplier_id=? WHERE id=?', [supplierId, applicationId]);
    await connection.execute('INSERT INTO application_timeline_events (id,application_id,event_name,event_source,actor_type,actor_reference,summary) VALUES (?,?,\'SUPPLIER_SELECTED\',\'STAFF_DESK\',?,?,?)', [randomUUID(), applicationId, requiredOwnerId === undefined ? 'ADMIN' : 'STAFF', actor, `Supplier ${current ?? 'none'} -> ${supplierId}`]);
    return { saved: true as const };
  });
}
