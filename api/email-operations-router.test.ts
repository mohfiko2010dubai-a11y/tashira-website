import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrpcContext } from './context';
import { createRouter } from './middleware';
import { emailOperationsRouter } from './email-operations-router';

const mocks = vi.hoisted(() => ({ scope: vi.fn(), execute: vi.fn() }));
vi.mock('./lib/operations/mysql-query-client', () => ({
  defaultOperationsSqlClient: () => ({ query: mocks.scope }),
  defaultOperationsPool: () => ({ execute: mocks.execute }),
}));
vi.mock('./lib/operations/mysql-access-provider', () => ({
  MysqlOperationsAccessProvider: class {
    async actorForContext() {
      return { id: 'staff:7', permissions: new Set(['case.read_assigned']), scopes: ['ASSIGNED'], teamIds: new Set(), departmentIds: new Set() };
    }
  },
}));
const router = createRouter({ emailOperations: emailOperationsRouter });
const context = (staffId?: number): TrpcContext => ({ req: new Request('https://example.invalid'), resHeaders: new Headers(), isAdmin: false, staffId, customerApplicationReferences: new Set() });

describe('case email delivery history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scope.mockResolvedValue([{ assignedStaffId: 7 }]);
    mocks.execute.mockResolvedValue([[{ id: 1, template: 'PAYMENT_SUCCESS', status: 'SENT', createdAt: '2026-10-09T00:00:00Z', recipient: 'PRIVATE', providerPayload: 'SECRET' },
      { id: 2, template: 'APPROVAL_PENDING', status: 'SENT', createdAt: '2026-10-09T00:00:00Z' }]]);
  });
  it('requires authentication and denies a different assignee before reading history', async () => {
    await expect(router.createCaller(context()).emailOperations.history({ referenceNumber: 'TSH-TEST' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    mocks.scope.mockResolvedValue([{ assignedStaffId: 8 }]);
    await expect(router.createCaller(context(7)).emailOperations.history({ referenceNumber: 'TSH-TEST' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('returns only customer delivery evidence for the assigned case, not admin notifications or provider payloads', async () => {
    const result = await router.createCaller(context(7)).emailOperations.history({ referenceNumber: 'TSH-TEST' });
    expect(result).toEqual([{ id: '1', template: 'PAYMENT_SUCCESS', status: 'SENT', createdAt: '2026-10-09T00:00:00.000Z' }]);
    expect(mocks.scope).toHaveBeenCalledWith(expect.any(String), ['TSH-TEST']);
    expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('WHERE a.reference_number=?'), ['TSH-TEST']);
  });
});
