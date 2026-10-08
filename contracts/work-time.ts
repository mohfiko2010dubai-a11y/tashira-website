import type { Availability } from './work-queue';
export type WorkTimeEvent = { at: number; applicationId: number | null; next: string };

/** Report declared work, not keystrokes. External wait is elapsed case time;
 * effort is intersected with explicitly declared availability and never summed
 * twice when historical active intervals overlap. Dates are clipped to the report. */
export function measureWorkTime(events: readonly WorkTimeEvent[], start: number, end: number) {
  let availability: Availability = 'OFF_DUTY';
  const states = new Map<number, string>();
  let cursor = start;
  let activeMs = 0, readyMs = 0, externalMs = 0, availableWithoutActiveMs = 0;
  const completed = new Set<number>();
  const accrue = (until: number) => {
    const delta = Math.max(0, Math.min(end, until) - cursor);
    const values = [...states.values()];
    if (availability === 'AVAILABLE') {
      if (values.includes('ACTIVE')) activeMs += delta;
      else availableWithoutActiveMs += delta;
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
      if (event.next === 'DONE' && event.at >= start) completed.add(event.applicationId);
      states.set(event.applicationId, event.next);
    }
  }
  accrue(end);
  return { activeMinutes: activeMs / 60000, readyMinutes: readyMs / 60000,
    externalCaseMinutes: externalMs / 60000, availableWithoutActiveMinutes: availableWithoutActiveMs / 60000, completedCount: completed.size };
}
