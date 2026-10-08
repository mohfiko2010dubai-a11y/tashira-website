export const WORK_STATES = ['READY', 'ACTIVE', 'WAIT_CUSTOMER', 'WAIT_AUTHORITY', 'WAIT_SUPPLIER', 'DONE'] as const;
export type WorkState = typeof WORK_STATES[number];
export const AVAILABILITY = ['AVAILABLE', 'BREAK', 'OFF_DUTY'] as const;
export type Availability = typeof AVAILABILITY[number];
export const workStateLabels: Record<WorkState, string> = {
  READY: 'جاهزة للاستكمال', ACTIVE: 'قيد العمل', WAIT_CUSTOMER: 'بانتظار العميل',
  WAIT_AUTHORITY: 'بانتظار قرار الهجرة', WAIT_SUPPLIER: 'بانتظار تأكيد التقديم من المورد', DONE: 'مكتملة',
};
export const WORK_LISTS = ['NEW', 'ACTIVE', 'READY', 'DUE', 'WAIT_CUSTOMER', 'WAIT_AUTHORITY', 'DONE'] as const;
export type WorkList = typeof WORK_LISTS[number];
export function workList(state: WorkState, dueAt: string | null, now: number): Exclude<WorkList, 'NEW'> {
  const bucket = workBucket(state, dueAt, now);
  // Retain the recorded distinction: a supplier handoff is not proof of filing.
  return bucket === 'WAIT_SUPPLIER' ? 'WAIT_AUTHORITY' : bucket;
}
export const availabilityLabels: Record<Availability, string> = {
  AVAILABLE: 'متاح لاستلام الطلبات', BREAK: 'استراحة', OFF_DUTY: 'خارج الدوام',
};

/** Operational work only; never changes the visa, payment or guarantee state. */
export function workBucket(state: WorkState, dueAt: string | null, now: number): WorkState | 'DUE' {
  return state.startsWith('WAIT_') && dueAt !== null && Date.parse(dueAt) <= now ? 'DUE' : state;
}

export function requireFollowUp(state: WorkState, dueAt: string | null, now: number): boolean {
  return !state.startsWith('WAIT_') || (dueAt !== null && Number.isFinite(Date.parse(dueAt)) && Date.parse(dueAt) > now);
}
