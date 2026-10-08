export const WORK_STATES = ['READY', 'ACTIVE', 'WAIT_CUSTOMER', 'WAIT_AUTHORITY', 'WAIT_SUPPLIER', 'DONE'] as const;
export type WorkState = typeof WORK_STATES[number];
export const AVAILABILITY = ['AVAILABLE', 'BREAK', 'OFF_DUTY'] as const;
export type Availability = typeof AVAILABILITY[number];
export const workStateLabels: Record<WorkState, string> = {
  READY: 'متابعة جاهزة', ACTIVE: 'أعمل عليه الآن', WAIT_CUSTOMER: 'بانتظار العميل',
  WAIT_AUTHORITY: 'متابعة الهجرة', WAIT_SUPPLIER: 'بانتظار المورد', DONE: 'أنهيت عملي',
};
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
