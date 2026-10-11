import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { renderTransactionalEmail } from './transactional-email';

const mocks = vi.hoisted(() => ({ limit: vi.fn(), update: vi.fn(), insert: vi.fn(), execute: vi.fn(), retrieve: vi.fn(), verify: vi.fn() }));
vi.mock('../queries/connection', () => ({ getDb: () => ({
  select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: mocks.limit }) }) }) }),
  transaction: async (work: (tx: object) => Promise<void>) => work({
    update: () => ({ set: () => ({ where: mocks.update }) }),
    insert: () => ({ values: mocks.insert }), execute: mocks.execute,
  }),
}) }));
vi.mock('./stripe', () => ({ retrieveStripeTestIntent: mocks.retrieve, verifySecurityDepositIntent: mocks.verify }));
import { finalizeSecurityDepositPayment } from './security-deposit-finalization';

const payment = { id: 'payment-1', requestId: 'request-1', applicationId: 233, amount: '10.00', status: 'PENDING' };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('PUBLIC_APP_URL', 'https://staging.tashiraev.com');
  mocks.limit.mockResolvedValue([payment]); mocks.update.mockResolvedValue([{ affectedRows: 1 }]);
  mocks.verify.mockReturnValue(true); mocks.retrieve.mockResolvedValue({});
});
afterEach(() => vi.unstubAllEnvs());

describe('deposit receipt durability', () => {
  it.each(['en', 'ar'])('queues one receipt with the verified amount, readable in %s HTML and plain text', async language => {
    await finalizeSecurityDepositPayment('pi_test', 'request-1');
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    const query = new MySqlDialect().sqlToQuery(mocks.execute.mock.calls[0][0]);
    expect(query.params.slice(0, 3)).toEqual(['application-status:security-deposit-paid:payment-1', 233, 'STATUS_CHANGED']);
    const variables = JSON.parse(String(query.params[3])) as Record<string, string>;
    const statusLabel = language === 'ar' ? variables.statusLabelAr : variables.statusLabelEn;
    const email = renderTransactionalEmail('STATUS_CHANGED', { referenceNumber: 'TSH-TEST', language, statusLabel });
    expect(email.body).toContain(statusLabel); expect(email.html).toContain(statusLabel);
    expect(email.body).toContain('10.00');
  });
  it('does not enqueue for a completed replay or a competing finalizer', async () => {
    mocks.limit.mockResolvedValueOnce([{ ...payment, status: 'SUCCEEDED' }]);
    await finalizeSecurityDepositPayment('pi_test');
    expect(mocks.retrieve).not.toHaveBeenCalled();
    mocks.update.mockResolvedValueOnce([{ affectedRows: 0 }]);
    await finalizeSecurityDepositPayment('pi_test');
    expect(mocks.execute).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('rejects unverified payments without a receipt', async () => {
    mocks.verify.mockReturnValue(false);
    await expect(finalizeSecurityDepositPayment('pi_test')).rejects.toThrow('verification failed');
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('propagates an outbox failure so the database transaction cannot commit payment alone', async () => {
    mocks.execute.mockRejectedValue(new Error('outbox unavailable'));
    await expect(finalizeSecurityDepositPayment('pi_test')).rejects.toThrow('outbox unavailable');
  });
});
