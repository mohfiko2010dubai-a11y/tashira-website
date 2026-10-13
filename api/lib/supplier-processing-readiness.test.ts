import { expect, it, vi } from 'vitest';
import type { PoolConnection } from 'mysql2/promise';
import { assertSupplierProcessingReady } from './supplier-processing-readiness';

function connection(row: Record<string, unknown>) {
  return { execute: vi.fn().mockResolvedValue([[row]]) } as unknown as PoolConnection;
}
it.each(['PROPOSED', 'ACCEPTED', 'PAYMENT_PENDING', 'REFUND_PENDING'])('keeps an original paid receipt from settling a %s amendment', async state => {
  await expect(assertSupplierProcessingReady(connection({ payment_status: 'paid', state, difference_minor: 3000 }), 1)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
});
it.each([null, 'SETTLED'])('allows paid processing with amendment state %s', async state => {
  await expect(assertSupplierProcessingReady(connection({ payment_status: 'paid', state }), 1)).resolves.toBeUndefined();
});
it('requires a recorded original-product refusal outcome, and never releases unpaid work', async () => {
  await expect(assertSupplierProcessingReady(connection({ payment_status: 'paid', state: 'REFUSED', original_approved: 0 }), 1)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  await expect(assertSupplierProcessingReady(connection({ payment_status: 'paid', state: 'REFUSED', original_approved: 1 }), 1)).resolves.toBeUndefined();
  await expect(assertSupplierProcessingReady(connection({ payment_status: 'pending', state: 'SETTLED' }), 1)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
});
