import type { CustomerWait } from "./processing-guarantee";

export type CustomerWaitReason = "DOCUMENTS_REQUESTED" | "AMENDMENT_SENT" | "PAYMENT_LINK_ISSUED" | "REFUSAL_PENDING_OUTCOME";
export type CustomerWaitEvent = {
  id: string;
  waitKey: string;
  kind: "PAUSE" | "RESUME";
  occurredAt: Date;
  reason: CustomerWaitReason;
};

/** Read projection only: no elapsed counter and no dependence on delivery/array order. */
export function projectCustomerWaits(events: readonly CustomerWaitEvent[], enabledAt: Date, asOf: Date) {
  if (![enabledAt.getTime(), asOf.getTime()].every(Number.isFinite)) throw new Error("Invalid customer-wait projection timestamp");
  const seen = new Map<string, string>();
  const groups = new Map<string, { pauses: CustomerWaitEvent[]; resumes: CustomerWaitEvent[] }>();
  for (const event of events) {
    if (!event.id.trim() || !event.waitKey.trim() || !Number.isFinite(event.occurredAt.getTime())) throw new Error("Invalid customer-wait event");
    const signature = JSON.stringify([event.waitKey, event.kind, event.occurredAt.toISOString(), event.reason]);
    const previous = seen.get(event.id);
    if (previous && previous !== signature) throw new Error("Conflicting customer-wait event replay");
    if (previous) continue;
    seen.set(event.id, signature);
    // No inferred pauses for historic orders; only events at/after activation contribute.
    if (event.occurredAt < enabledAt || event.occurredAt > asOf) continue;
    const group = groups.get(event.waitKey) ?? { pauses: [], resumes: [] };
    group[event.kind === "PAUSE" ? "pauses" : "resumes"].push(event);
    groups.set(event.waitKey, group);
  }
  const intervals: CustomerWait[] = [];
  const open: { waitKey: string; reason: CustomerWaitReason; startedAt: Date }[] = [];
  for (const [waitKey, group] of groups) {
    const pause = group.pauses.sort((a, b) => +a.occurredAt - +b.occurredAt || a.id.localeCompare(b.id))[0];
    if (!pause) continue;
    const resume = group.resumes.sort((a, b) => +a.occurredAt - +b.occurredAt || a.id.localeCompare(b.id))[0];
    // A response received before a delayed sent notification closes the wait; it must not reopen it.
    if (resume && resume.occurredAt <= pause.occurredAt) continue;
    intervals.push({ startedAt: pause.occurredAt, resumedAt: resume?.occurredAt ?? null });
    if (!resume) open.push({ waitKey, reason: pause.reason, startedAt: pause.occurredAt });
  }
  intervals.sort((a, b) => +a.startedAt - +b.startedAt);
  open.sort((a, b) => +a.startedAt - +b.startedAt || a.waitKey.localeCompare(b.waitKey));
  return { intervals, open };
}

export function overdueCustomerWaits(events: readonly CustomerWaitEvent[], enabledAt: Date, asOf: Date, thresholdHours: number) {
  if (!Number.isFinite(thresholdHours) || thresholdHours <= 0) throw new Error("Configure a positive customer-wait threshold");
  return projectCustomerWaits(events, enabledAt, asOf).open.filter(wait => +asOf - +wait.startedAt > thresholdHours * 3_600_000);
}
