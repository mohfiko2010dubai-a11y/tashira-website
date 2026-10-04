import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrpcContext } from './context';

const mocks = vi.hoisted(() => ({ rows: vi.fn(), change: vi.fn(), event: vi.fn(), password: vi.fn() }));
vi.mock('./lib/named-staff-password', () => ({ verifyNamedStaffPassword: mocks.password }));
vi.mock('./queries/connection', () => ({ getDb: () => ({
  transaction: async (work: (tx: object) => Promise<unknown>) => work({
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.rows }) }) }),
    update: () => ({ set: (value: object) => { mocks.change(value); return { where: async () => [{ affectedRows: 1 }] }; } }),
    insert: () => ({ values: mocks.event }),
  }),
}) }));
import { refundRouter } from './refund-router';

function caller(staffId?: number, isAdmin = true) {
  const context: TrpcContext = { req: new Request('https://staging.tashiraev.com/api/trpc'), resHeaders: new Headers(), isAdmin, staffId, customerApplicationReferences: new Set() };
  return refundRouter.createCaller(context);
}
const input = { refundCaseId: 'a153205e-e7a5-4b48-8b0d-c4d01d62e99e', adminPassword: 'synthetic-re-authentication' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.password.mockImplementation(async (id: number | undefined) => Boolean(id));
  mocks.rows.mockResolvedValue([{ applicationId: 91, requestedBy: 'staff:17' }]);
  mocks.event.mockResolvedValue(undefined);
});
describe('named refund maker/checker through the actual router', () => {
  it.each([17, 19])('rejects agent %i regardless of whether they made this refund request', async staffId => {
    await expect(caller(staffId, false).approveCase(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it('allows a different named checker and persists that identity', async () => {
    await expect(caller(18).approveCase(input)).resolves.toEqual({ status: 'APPROVED' });
    expect(mocks.change).toHaveBeenCalledWith(expect.objectContaining({ approvedBy: 'staff:18' }));
    expect(mocks.event).toHaveBeenCalledWith(expect.objectContaining({ actorReference: 'staff:18' }));
  });
  it('rejects self approval without changing the request', async () => {
    await expect(caller(17).approveCase(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it('rejects a legacy shared administrator without a named identity', async () => {
    await expect(caller().approveCase(input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mocks.change).not.toHaveBeenCalled();
  });
});
