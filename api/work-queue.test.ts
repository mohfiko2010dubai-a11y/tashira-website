import { describe, expect, it } from 'vitest';
import { requireFollowUp, workBucket } from '../contracts/work-queue';
import { workCommand } from './lib/operations/mysql-work-queue';

describe('work queue follow-up semantics', () => {
  const now = Date.parse('2026-10-08T10:00:00Z');
  it('waiting turns due at the deadline without becoming complete', () => {
    expect(workBucket('WAIT_CUSTOMER', '2026-10-08T10:00:00Z', now)).toBe('DUE');
    expect(workBucket('WAIT_AUTHORITY', '2026-10-08T11:00:00Z', now)).toBe('WAIT_AUTHORITY');
    expect(workBucket('DONE', '2026-10-08T09:00:00Z', now)).toBe('DONE');
  });
  it('waiting requires an actual future follow-up; ready work does not', () => {
    expect(requireFollowUp('WAIT_SUPPLIER', null, now)).toBe(false);
    expect(requireFollowUp('WAIT_CUSTOMER', 'invalid', now)).toBe(false);
    expect(requireFollowUp('WAIT_AUTHORITY', '2026-10-08T09:00:00Z', now)).toBe(false);
    expect(requireFollowUp('WAIT_SUPPLIER', '2026-10-08T11:00:00Z', now)).toBe(true);
    expect(requireFollowUp('READY', null, now)).toBe(true);
  });
  it('rejects client-selected assignees and silent reasonless changes', () => {
    expect(workCommand.safeParse({ kind: 'CLAIM', includeTest: false, key: crypto.randomUUID(), staffId: 1 }).success).toBe(false);
    expect(workCommand.safeParse({ kind: 'WORK_STATE', applicationId: 1, version: 0, state: 'DONE', reason: '', followUpAt: null, key: crypto.randomUUID() }).success).toBe(false);
  });
});
