import { describe, expect, it } from 'vitest';
import { WORK_STATES, workList } from '../../../contracts/work-queue';
import { workStateAfterStatus } from './case-work-status';

describe('application status drives the employee work list', () => {
  it('moves every previous work state into the correct waiting or closed list', () => {
    for (const previous of WORK_STATES) {
      expect(workStateAfterStatus('documents_pending', previous)).toBe('WAIT_CUSTOMER');
      expect(workStateAfterStatus('visa_processing', previous)).toBe('WAIT_AUTHORITY');
      for (const status of ['completed', 'cancelled', 'rejected']) expect(workStateAfterStatus(status, previous)).toBe('DONE');
    }
  });
  it('returns received documents and visa decisions to work, including previously closed cases', () => {
    for (const previous of WORK_STATES) {
      for (const status of ['submitted', 'payment_received', 'documents_received', 'visa_received']) {
        expect(workStateAfterStatus(status, previous)).toBe('READY');
      }
      expect(workStateAfterStatus('under_review', previous)).toBe(previous === 'ACTIVE' ? 'ACTIVE' : 'READY');
    }
    expect(workList('WAIT_SUPPLIER', null, Date.now())).toBe('WAIT_AUTHORITY');
    expect(() => workStateAfterStatus('invented', 'ACTIVE')).toThrow();
  });
});
