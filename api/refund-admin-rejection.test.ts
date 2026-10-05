import { beforeEach, expect, it, vi } from 'vitest';
import type { TrpcContext } from './context';
const mocks = vi.hoisted(() => ({ change: vi.fn(), event: vi.fn() }));
vi.mock('./queries/connection', () => ({ getDb: () => ({
  transaction: async (work: (tx: object) => Promise<unknown>) => work({
    select: () => ({ from: () => ({ where: () => ({ limit: () => ({ for: async () => [{ id, applicationId: 91, status: 'PENDING_APPROVAL', requestedBy: 'staff:17' }] }) }) }) }),
    update: () => ({ set: (value: object) => ({ where: async () => { mocks.change(value); return [{ affectedRows: 1 }]; } }) }),
    insert: () => ({ values: mocks.event }),
  }),
}) }));
import { refundQueueRouter } from './refund-queue-router';
const id = '00000000-0000-4000-8000-000000000042';
const input = { refundCaseId: id, reason: 'Duplicate test request' };
function caller(staffId: number | undefined, isAdmin = true) {
  const context: TrpcContext = { req: new Request('https://staging.tashiraev.com'), resHeaders: new Headers(), isAdmin, staffId, customerApplicationReferences: new Set() };
  return refundQueueRouter.createCaller(context);
}
beforeEach(() => vi.clearAllMocks());
it('allows the named administrator to reject their own request and records the reason', async () => {
  await expect(caller(17).reject(input)).resolves.toEqual({ success: true });
  expect(mocks.event).toHaveBeenCalledWith(expect.objectContaining({ actorReference: 'staff:17', summary: 'Refund rejected: Duplicate test request' }));
});
it.each([17, 19])('rejects agent %i even when deciding another agent request', async staffId => {
  await expect(caller(staffId, false).reject(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect(mocks.change).not.toHaveBeenCalled();
});
it('requires a named administrator and a rejection reason', async () => {
  await expect(caller(undefined).reject(input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  await expect(caller(17).reject({ ...input, reason: '' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  expect(mocks.change).not.toHaveBeenCalled();
});
