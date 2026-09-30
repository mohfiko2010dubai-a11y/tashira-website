/** Elapsed hours, including nights/weekends. Never authority issuance time. */
export const PROCESSING_GUARANTEE_VERSION = "2026-09-30";
export const REGULAR_SUBMISSION_HOURS = 48;
export const EXPRESS_SUBMISSION_HOURS = 24;
export function submissionDeadline(completedAt: Date, express: boolean) {
  return new Date(completedAt.getTime() + (express ? EXPRESS_SUBMISSION_HOURS : REGULAR_SUBMISSION_HOURS) * 3_600_000);
}
export function submissionBreached(completedAt: Date | null, submittedAt: Date | null, express: boolean, now = new Date()) {
  return completedAt !== null && (submittedAt ?? now).getTime() > submissionDeadline(completedAt, express).getTime();
}
export function refundableExpressFee(regularUnit: number, expressUnit: number, count: number) {
  if (![regularUnit, expressUnit].every(Number.isFinite) || regularUnit < 0 || expressUnit < regularUnit || !Number.isInteger(count) || count < 1) throw new Error("Invalid Express fee component");
  return Math.round((Math.round(expressUnit * 100) - Math.round(regularUnit * 100)) * count) / 100;
}
