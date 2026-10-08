import { describe, expect, it } from 'vitest';
import { measureWorkTime } from '../contracts/work-time';
describe('declared work timing', () => {
  it('excludes breaks, distinguishes external waits and never doubles active time', () => {
    const events = [
      { at: 0, applicationId: null, next: 'AVAILABLE' },
      { at: 0, applicationId: 1, next: 'ACTIVE' },
      { at: 60000, applicationId: 2, next: 'ACTIVE' },
      { at: 120000, applicationId: null, next: 'BREAK' },
      { at: 180000, applicationId: 1, next: 'WAIT_CUSTOMER' },
      { at: 180000, applicationId: 2, next: 'DONE' },
      { at: 240000, applicationId: null, next: 'AVAILABLE' },
    ];
    expect(measureWorkTime(events, 0, 300000)).toEqual({ activeMinutes: 2, readyMinutes: 0, externalCaseMinutes: 2, availableWithoutActiveMinutes: 1, completedCount: 1 });
  });
  it('clips previous-day sessions and counts a repeatedly closed case only once', () => {
    expect(measureWorkTime([
      { at: 0, applicationId: null, next: 'AVAILABLE' }, { at: 0, applicationId: 1, next: 'ACTIVE' },
      { at: 120000, applicationId: 1, next: 'DONE' }, { at: 150000, applicationId: 1, next: 'DONE' },
    ], 60000, 180000)).toMatchObject({ activeMinutes: 1, completedCount: 1 });
  });
});
