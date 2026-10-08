import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('./checkout-quote', () => ({ withCheckoutLock: async (_id: number, work: (c: { execute: typeof mocks.execute }) => unknown) => work({ execute: mocks.execute }) }));
import { selectCaseSupplier } from './supplier-selection';
beforeEach(() => mocks.execute.mockReset());
function setup(row: Record<string, unknown> = {}, owner = 7, active = true) {
  mocks.execute.mockResolvedValueOnce([[{ status: 'under_review', supplier_id: null, ...row }]])
    .mockResolvedValueOnce([[{ assigned_staff_user_id: owner }]])
    .mockResolvedValueOnce([active ? [{ id: 2 }] : []]).mockResolvedValue([[]]);
}
it('saves only the supplier and a named audit event, never finance or customer status', async () => {
  setup();
  await expect(selectCaseSupplier(42, 2, null, 'staff:7', 7)).resolves.toEqual({ saved: true });
  expect(mocks.execute.mock.calls[3]).toEqual(['UPDATE applications SET supplier_id=? WHERE id=?', [2, 42]]);
  expect(mocks.execute.mock.calls[4][1]).toEqual([expect.any(String), 42, 'STAFF', 'staff:7', 'Supplier none -> 2']);
});
it('rejects a reassignment race before changing the supplier', async () => {
  setup({}, 8);
  await expect(selectCaseSupplier(42, 2, null, 'staff:7', 7)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(mocks.execute).toHaveBeenCalledTimes(2);
});
it('rejects a stale selection', async () => {
  setup({ supplier_id: 3 });
  await expect(selectCaseSupplier(42, 2, null, 'staff:7', 7)).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(mocks.execute).toHaveBeenCalledTimes(2);
});
it('treats repeated saves as no-ops without duplicate audit entries', async () => {
  setup({ supplier_id: 2 });
  await selectCaseSupplier(42, 2, null, 'staff:7', 7);
  expect(mocks.execute).toHaveBeenCalledTimes(2);
});
it.each(['visa_processing', 'visa_received', 'completed', 'cancelled', 'rejected'])('does not change a %s supplier', async status => {
  setup({ status });
  await expect(selectCaseSupplier(42, 2, null, 'staff:7', 7)).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(mocks.execute).toHaveBeenCalledTimes(2);
});
it('rejects inactive suppliers', async () => {
  setup({}, 7, false);
  await expect(selectCaseSupplier(42, 2, null, 'staff:7', 7)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  expect(mocks.execute).toHaveBeenCalledTimes(3);
});
it.each([{ supplier_total_aed: '100.00' }, { supplier_invoice_number: 'EXISTING' }, { supplier_paid: 'paid' }])('preserves existing financial entries %j', async row => {
  setup(row);
  await expect(selectCaseSupplier(42, 2, null, 'staff:7', 7)).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(mocks.execute).toHaveBeenCalledTimes(2);
});
