import { describe, expect, it, vi } from 'vitest';
import type { PoolConnection } from 'mysql2/promise';
import { enqueueApplicationStatusEmail } from './application-status-outbox';

const change = { applicationId: 17, from: 'under_review', to: 'cancelled', eventId: 'event-one', actor: 'staff:8', actorType: 'STAFF' as const };
describe('committed status notification intent', () => {
  it('does not enqueue a same-state save', async () => {
    const execute = vi.fn();
    await enqueueApplicationStatusEmail({ execute } as unknown as PoolConnection, { ...change, from: 'cancelled' });
    expect(execute).not.toHaveBeenCalled();
  });
  it('rejects unpersisted or unknown states without writing mail', async () => {
    const execute = vi.fn().mockResolvedValue([[{ status: 'under_review', preferred_language: 'en' }]]);
    const connection = { execute } as unknown as PoolConnection;
    await expect(enqueueApplicationStatusEmail(connection, change)).rejects.toThrow('persisted');
    await expect(enqueueApplicationStatusEmail(connection, { ...change, to: 'invented' })).rejects.toThrow('Unknown');
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it.each(['en', 'ar'])('records %s cancellation independently from refund completion and uses the source event key', async language => {
    const execute = vi.fn().mockResolvedValueOnce([[{ status: 'cancelled', preferred_language: language }]]).mockResolvedValue([{}]);
    await enqueueApplicationStatusEmail({ execute } as unknown as PoolConnection, change);
    const [sql, parameters] = execute.mock.calls[2];
    expect(sql).toContain('transactional_email_jobs');
    expect(parameters.slice(0, 3)).toEqual(['application-status:event-one', 17, 'STATUS_CHANGED']);
    const variables = JSON.parse(parameters[3]);
    expect(variables.statusLabel).toBe(language === 'ar' ? variables.statusLabelAr : variables.statusLabelEn);
    expect(variables.statusLabelEn).toContain('Any refund is confirmed separately');
    expect(parameters[2]).not.toBe('REFUND_COMPLETED');
  });
});
