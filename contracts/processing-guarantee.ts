/** Elapsed hours, including nights/weekends. Never authority issuance time. */
export const PROCESSING_GUARANTEE_VERSION = "2026-09-30";
export const REGULAR_SUBMISSION_HOURS = 48;
export const EXPRESS_SUBMISSION_HOURS = 24;
export type CustomerWait = { startedAt: Date; resumedAt: Date | null };

/** Union of customer waits: concurrent missing documents and price consent count once. */
export function customerWaitMilliseconds(completedAt: Date, until: Date, waits: readonly CustomerWait[]) {
  const start = completedAt.getTime(), end = until.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("Invalid service-clock timestamp");
  const intervals = waits.map(wait => {
    const from = wait.startedAt.getTime(), to = wait.resumedAt?.getTime() ?? end;
    if (!Number.isFinite(from) || !Number.isFinite(to) || (wait.resumedAt && to < from)) throw new Error("Invalid customer-wait interval");
    return [Math.max(start, from), Math.min(end, to)] as const;
  }).filter(([from, to]) => to > from).sort((a, b) => a[0] - b[0]);
  let milliseconds = 0, mergedEnd = start;
  for (const [from, to] of intervals) {
    milliseconds += Math.max(0, to - Math.max(from, mergedEnd));
    mergedEnd = Math.max(mergedEnd, to);
  }
  return milliseconds;
}

/** While paused the displayed deadline is provisional; it advances with customer-held time. */
export function submissionDeadline(completedAt: Date, express: boolean, waits: readonly CustomerWait[] = [], asOf = new Date()) {
  return new Date(completedAt.getTime() + (express ? EXPRESS_SUBMISSION_HOURS : REGULAR_SUBMISSION_HOURS) * 3_600_000
    + customerWaitMilliseconds(completedAt, asOf, waits));
}
export function submissionBreached(completedAt: Date | null, submittedAt: Date | null, express: boolean, now = new Date(), waits: readonly CustomerWait[] = []) {
  const until = submittedAt ?? now;
  return completedAt !== null && until.getTime() > submissionDeadline(completedAt, express, waits, until).getTime();
}
export function refundableExpressFee(regularUnit: number, expressUnit: number, count: number) {
  if (![regularUnit, expressUnit].every(Number.isFinite) || regularUnit < 0 || expressUnit < regularUnit || !Number.isInteger(count) || count < 1) throw new Error("Invalid Express fee component");
  return Math.round((Math.round(expressUnit * 100) - Math.round(regularUnit * 100)) * count) / 100;
}
