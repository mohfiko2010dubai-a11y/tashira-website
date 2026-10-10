import type { Availability } from './work-queue';
export type WorkTimeEvent = { at: number; applicationId: number | null; next: string; reportable?: boolean };

/** Report declared work, not keystrokes. External wait is elapsed case time;
 * effort is intersected with explicitly declared availability and never summed
 * twice when historical active intervals overlap. Dates are clipped to the report. */
export function measureWorkTime(events: readonly WorkTimeEvent[], start: number, end: number) {
  let availability: Availability = 'OFF_DUTY';
  const states = new Map<number, { next: string; reportable: boolean }>();
  let cursor = start;
  let activeMs = 0, readyMs = 0, externalMs = 0, availableWithoutActiveMs = 0;
  const completed = new Set<number>();
  const accrue = (until: number) => {
    const delta = Math.max(0, Math.min(end, until) - cursor);
    const all = [...states.values()];
    const values = all.filter(value => value.reportable).map(value => value.next);
    if (availability === 'AVAILABLE') {
      if (values.includes('ACTIVE')) activeMs += delta;
      else if (!all.some(value => value.next === 'ACTIVE')) availableWithoutActiveMs += delta;
      if (values.includes('READY')) readyMs += delta;
    }
    externalMs += delta * values.filter(value => value.startsWith('WAIT_')).length;
    cursor = Math.max(cursor, Math.min(end, until));
  };
  for (const event of [...events].sort((a,b) => a.at-b.at)) {
    if (!Number.isFinite(event.at) || event.at > end) continue;
    accrue(event.at);
    if (event.applicationId === null) {
      if (['AVAILABLE','BREAK','OFF_DUTY'].includes(event.next)) availability = event.next as Availability;
    } else {
      if (event.next === 'DONE' && event.at >= start && event.reportable !== false) completed.add(event.applicationId);
      else if (event.next !== 'DONE' && event.next !== 'TRANSFERRED') completed.delete(event.applicationId);
      states.set(event.applicationId, { next: event.next, reportable: event.reportable !== false });
    }
  }
  accrue(end);
  return { activeMinutes: activeMs / 60000, readyMinutes: readyMs / 60000,
    externalCaseMinutes: externalMs / 60000, availableWithoutActiveMinutes: availableWithoutActiveMs / 60000, completedCount: completed.size };
}

export type ClosureEvent = WorkTimeEvent & {
  staffId: number; reference: string; visaType: string; processingType: string; applicationStatus: string;
};

/** Latest recorded closure only: a reopening removes earlier credit for every owner. */
export function currentWorkClosures(events: readonly ClosureEvent[], start: number, end: number) {
  const latest = new Map<number, ClosureEvent>();
  for (const event of [...events].sort((a, b) => a.at - b.at)) {
    if (event.applicationId !== null && Number.isFinite(event.at) && event.at <= end) latest.set(event.applicationId, event);
  }
  return [...latest.values()].filter(event => event.reportable !== false && event.next === 'DONE' && event.at >= start
    && ['completed', 'cancelled', 'rejected'].includes(event.applicationStatus));
}
