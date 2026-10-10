import { z } from 'zod';

const money = z.string().regex(/^(0|[1-9]\d{0,5})(\.\d{1,2})?$/, 'أدخل مبلغًا بالدرهم لا يزيد على منزلتين عشريتين.');
export const supplierVatStatus = z.enum(['standard', 'zero_rated', 'exempt', 'out_of_scope']);
export const supplierPlaceOfSupply = z.enum(['within_uae', 'outside_uae']);
export const supplierRateInput = z.object({
  supplierId: z.number().int().positive(),
  serviceCode: z.string().trim().min(1).max(80),
  processingType: z.enum(['regular', 'express']),
  expectedVersion: z.number().int().nonnegative(),
  costAed: money,
  vatAmountAed: money,
  vatStatus: supplierVatStatus,
  placeOfSupply: supplierPlaceOfSupply,
  active: z.boolean(),
  reason: z.string().trim().min(1, 'اكتب سبب تحديث السعر.').max(500),
}).strict().superRefine((value, context) => {
  if (value.vatStatus !== 'standard' && Number(value.vatAmountAed) !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['vatAmountAed'], message: 'هذه المعاملة الضريبية تتطلب مبلغ ضريبة صفر. راجع المعاملة أو مبلغ الضريبة.' });
  }
});
export type SupplierRateInput = z.infer<typeof supplierRateInput>;
export function aedMinorUnits(amount: string): number {
  const [whole, fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function aedAmount(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}
