import { beforeEach, describe, expect, it, vi } from 'vitest';
import { financialEvents } from '../../db/schema';

const mocks = vi.hoisted(() => ({ rows: vi.fn(), changes: vi.fn(), insert: vi.fn(), post: vi.fn(), balance: vi.fn(), accounting: vi.fn(), email: vi.fn() }));
vi.mock('../queries/connection', () => {
  const db = {
    select: () => {
      const chain = {
        from: () => chain, leftJoin: () => chain, where: () => chain, limit: () => mocks.rows(),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mocks.rows().then(resolve, reject),
      };
      return chain;
    },
    update: (table: unknown) => ({ set: (value: object) => { mocks.changes(table, value); return { where: async () => [{ affectedRows: 1 }] }; } }),
    insert: (table: unknown) => ({ values: async (value: unknown) => mocks.insert(table, value) }),
    transaction: async (work: (tx: object) => Promise<unknown>): Promise<unknown> => work(db),
  };
  return { getDb: () => db };
});
vi.mock('./stripe', () => ({ createStripeRefund: mocks.post, StripeRefundRejected: class extends Error {} }));
vi.mock('./refund-provider-summary', () => ({ refundChargeSummary: mocks.balance }));
vi.mock('./refund-credit-note', () => ({ completeVisaRefundWithCreditNote: mocks.accounting }));
vi.mock('./refund-outcome-email', () => ({ sendRefundOutcomeEmail: mocks.email }));
import { executeApprovedRefund } from './execute-refund';
import { StripeRefundRejected } from './stripe';

const item = { id: 'retry-item', sourceType: 'VISA_SERVICE', paymentId: 1, refundAmount: '25.00', currency: 'USD', idempotencyKey: 'original-stable-key', paymentIntentId: 'pi_test' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.balance.mockResolvedValue({ currency: 'USD', remainingMinor: 2500 });
  mocks.email.mockResolvedValue({ status: 'SENT' });
  mocks.rows.mockResolvedValueOnce([{ id: 'case', applicationId: 91, status: 'APPROVED' }]).mockResolvedValueOnce([item]);
});
describe('execution of a partially completed refund retry', () => {
  it('sends only the pending item with its original key and records only its new financial event', async () => {
    mocks.post.mockResolvedValue({ id: 're_new', status: 'succeeded' });
    mocks.rows.mockResolvedValueOnce([{ status: 'SUCCEEDED' }, { status: 'SUCCEEDED' }])
      .mockResolvedValueOnce([{ ...item, stripeRefundId: 're_new' }]);
    await expect(executeApprovedRefund('case', 'staff:18')).resolves.toMatchObject({ status: 'REFUNDED', succeededItems: 1 });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 2500, idempotencyKey: 'original-stable-key' }));
    expect(mocks.accounting).toHaveBeenCalledWith('retry-item', { id: 're_new', status: 'succeeded' });
    const records = mocks.insert.mock.calls.filter(([table]) => table === financialEvents);
    expect(records).toHaveLength(1);
    expect(records[0][1]).toEqual([expect.objectContaining({ sourceReference: 're_new', amount: '25.00' })]);
  });
  it('keeps the earlier success when Stripe definitively rejects the retried item', async () => {
    mocks.post.mockRejectedValue(new StripeRefundRejected('Declined'));
    mocks.rows.mockResolvedValueOnce([{ status: 'SUCCEEDED' }, { status: 'FAILED' }]);
    await expect(executeApprovedRefund('case', 'staff:18')).resolves.toMatchObject({ status: 'PARTIALLY_REFUNDED', succeededItems: 0 });
    expect(mocks.accounting).not.toHaveBeenCalled();
    expect(mocks.insert.mock.calls.filter(([table]) => table === financialEvents)).toHaveLength(0);
  });
  it('does not make an uncertain Stripe request retryable after a connection timeout', async () => {
    mocks.post.mockRejectedValue(new Error('Connection timed out'));
    mocks.rows.mockResolvedValueOnce([{ status: 'SUCCEEDED' }, { status: 'PROCESSING' }]);
    await expect(executeApprovedRefund('case', 'staff:18')).resolves.toMatchObject({ status: 'PROCESSING' });
    expect(mocks.changes.mock.calls.some(([, value]) => value.status === 'FAILED')).toBe(false);
  });
});
