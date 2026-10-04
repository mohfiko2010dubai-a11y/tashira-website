import { beforeEach, expect, it, vi } from 'vitest';
import type { TrpcContext } from './context';
const mocks = vi.hoisted(() => ({ rows: vi.fn(), change: vi.fn(), sequence: [] as string[] }));
vi.mock('./queries/connection', () => ({ getDb: () => ({
  transaction: async (work: (tx: object) => Promise<unknown>) => work({
    select: () => {
      const read = () => { mocks.sequence.push('read'); return mocks.rows(); };
      const chain = { from: () => chain, where: () => chain, limit: () => chain, for: read,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => read().then(resolve, reject) };
      return chain;
    },
    update: () => ({ set: (value: object) => ({ where: async () => { mocks.sequence.push('reserve'); mocks.change(value); return [{ affectedRows: 1 }]; } }) }),
  }),
}) }));
import { refundQueueRouter } from './refund-queue-router';
const id = '00000000-0000-4000-8000-000000000042';
const context: TrpcContext = { req: new Request('https://staging.tashiraev.com'), resHeaders: new Headers(), isAdmin: true, staffId: 18, customerApplicationReferences: new Set() };
beforeEach(() => {
  vi.resetAllMocks(); mocks.sequence.length = 0;
  mocks.rows.mockResolvedValueOnce([{ applicationId: 91 }]).mockResolvedValueOnce([{ id: 91 }])
    .mockResolvedValueOnce([{ id, status: 'PARTIALLY_REFUNDED' }]);
});
it('requires a new checker approval and reserves each failed item before checking the next balance', async () => {
  mocks.rows.mockResolvedValueOnce([{ id: 'a', paymentId: 1, refundAmount: '20.00' }, { id: 'b', paymentId: 1, refundAmount: '30.00' }])
    .mockResolvedValueOnce([{ amount: '100.00' }]).mockResolvedValueOnce([{ total: '50.00' }])
    .mockResolvedValueOnce([{ amount: '100.00' }]).mockResolvedValueOnce([{ total: '70.00' }]);
  await expect(refundQueueRouter.createCaller(context).retry({ refundCaseId: id })).resolves.toEqual({ success: true });
  expect(mocks.sequence).toEqual(['read','read','read','read','read','read','reserve','read','read','reserve','reserve']);
  expect(mocks.change).toHaveBeenLastCalledWith({ status: 'PENDING_APPROVAL', approvedAt: null, approvedBy: null });
});
it('rejects a retry with no failed items instead of re-sending completed ones', async () => {
  mocks.rows.mockResolvedValueOnce([]);
  await expect(refundQueueRouter.createCaller(context).retry({ refundCaseId: id })).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(mocks.change).not.toHaveBeenCalled();
});
