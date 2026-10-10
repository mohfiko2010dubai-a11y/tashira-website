import { describe, expect, it } from 'vitest';
import { currentWorkClosures, measureWorkTime } from '../contracts/work-time';
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
  it('removes reopened cases from completion and credits only their latest closing employee', () => {
    const base = { applicationId: 1, reference: 'SYNTHETIC', visaType: '30days-single', processingType: 'regular', applicationStatus: 'completed' };
    const events = [{ ...base, staffId: 1, at: 100, next: 'DONE' }, { ...base, staffId: 2, at: 200, next: 'ACTIVE' }];
    expect(currentWorkClosures(events, 0, 250)).toEqual([]);
    events.push({ ...base, staffId: 2, at: 300, next: 'DONE' });
    expect(currentWorkClosures(events, 0, 400).map(row => row.staffId)).toEqual([2]);
    expect(currentWorkClosures(events, 301, 400)).toEqual([]);
    expect(currentWorkClosures(events.map(row => ({ ...row, applicationStatus: 'under_review' })), 0, 400)).toEqual([]);
    expect(currentWorkClosures(events.map(row => ({ ...row, reportable: false })), 0, 400)).toEqual([]);
    expect(measureWorkTime(events, 0, 250).completedCount).toBe(0);
  });
  it('excludes test work without labelling its active time as employee idle time', () => {
    const events = [{ at: 0, applicationId: null, next: 'AVAILABLE' },
      { at: 0, applicationId: 1, next: 'ACTIVE', reportable: false },
      { at: 60000, applicationId: 1, next: 'DONE', reportable: false }];
    expect(measureWorkTime(events, 0, 120000)).toMatchObject({ activeMinutes: 0, availableWithoutActiveMinutes: 1, completedCount: 0 });
    expect(measureWorkTime(events.map(row => ({ ...row, reportable: true })), 0, 120000)).toMatchObject({ activeMinutes: 1, availableWithoutActiveMinutes: 1, completedCount: 1 });
  });
});
