import { describe, expect, it } from 'vitest';
import { workList, workStateLabels } from '../contracts/work-queue';

describe('unified work lists', () => {
  it('groups supplier follow-up with authority follow-up without claiming filing', () => {
    expect(workList('WAIT_SUPPLIER', null, 0)).toBe('WAIT_AUTHORITY');
    expect(workStateLabels.WAIT_SUPPLIER).toBe('بانتظار تأكيد التقديم من المورد');
    expect(workList('WAIT_AUTHORITY', null, 0)).toBe('WAIT_AUTHORITY');
  });
  it('keeps overdue follow-up actionable and customer waits separate', () => {
    expect(workList('WAIT_SUPPLIER', '2026-10-01T00:00:00Z', Date.parse('2026-10-09'))).toBe('DUE');
    expect(workList('WAIT_CUSTOMER', null, 0)).toBe('WAIT_CUSTOMER');
    expect(workList('DONE', null, 0)).toBe('DONE');
  });
});
