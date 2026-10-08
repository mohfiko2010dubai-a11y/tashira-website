import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrpcContext } from './context';
import { createRouter } from './middleware';
import { applicationRouter } from './application-router';

const mocks = vi.hoisted(() => ({ scope: vi.fn(), propose: vi.fn(), application: vi.fn(), consent: vi.fn() }));
vi.mock('./lib/operations/mysql-query-client', () => ({
  defaultOperationsSqlClient: () => ({ query: mocks.scope }),
  defaultOperationsPool: () => ({}),
}));
vi.mock('./lib/operations/mysql-access-provider', () => ({
  MysqlOperationsAccessProvider: class {
    async actorForContext() {
      return { id: 'staff:7', permissions: new Set(['case.read_assigned', 'case.transition']), scopes: ['ASSIGNED'], teamIds: new Set(), departmentIds: new Set() };
    }
  },
}));
vi.mock('./lib/application-projection', () => ({ getCanonicalApplicationByReference: mocks.application }));
vi.mock('./lib/product-substitution', () => ({ proposeSubmittedProduct: mocks.propose, acknowledgeSubmittedProduct: mocks.consent }));
const router = createRouter({ application: applicationRouter });
const context = (staffId?: number): TrpcContext => ({ req: new Request('https://example.invalid'), resHeaders: new Headers(), isAdmin: false, staffId, customerApplicationReferences: new Set() });
const input = { referenceNumber: 'TSH-SYNTHETIC', product: '60days-single', reason: 'Customer requested a longer stay' };

describe('staff visa-change proposal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scope.mockResolvedValue([{ assignedStaffId: 7 }]);
    mocks.application.mockResolvedValue({ id: 42 });
    mocks.propose.mockResolvedValue({ version: 3 });
  });
  it('lets the assigned employee propose with a named audit actor, without granting customer consent', async () => {
    const caller = router.createCaller(context(7));
    await expect(caller.application.proposeSubmittedProduct(input)).resolves.toEqual({ version: 3 });
    expect(mocks.propose).toHaveBeenCalledWith(42, input.product, 'staff:7', input.reason, 7);
    await expect(caller.application.acknowledgeSubmittedProduct({ referenceNumber: input.referenceNumber, version: 3, quoteId: '00000000-0000-4000-8000-000000000003' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.consent).not.toHaveBeenCalled();
  });
  it('rejects anonymous and other-assignee proposals before touching the quote', async () => {
    await expect(router.createCaller(context()).application.proposeSubmittedProduct(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    mocks.scope.mockResolvedValue([{ assignedStaffId: 8 }]);
    await expect(router.createCaller(context(7)).application.proposeSubmittedProduct(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.propose).not.toHaveBeenCalled();
  });
});
