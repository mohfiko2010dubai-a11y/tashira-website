import { submissionDeadline } from "../../contracts/processing-guarantee";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { projectCustomerWaits, type CustomerWaitEvent } from "../../contracts/customer-wait-events";
import { defaultOperationsPool } from "./operations/mysql-query-client";

export async function customerWaitLog(applicationId: number, asOf = new Date(), connection: Pick<PoolConnection, "execute"> = defaultOperationsPool()) {
  const [policy] = await connection.execute<RowDataPacket[]>("SELECT UNIX_TIMESTAMP(enabled_at) enabled_at,overdue_hours FROM customer_wait_policy WHERE singleton=1");
  if (!policy[0]) throw new Error("Customer wait policy is missing");
  const thresholdHours = Number(policy[0].overdue_hours);
  if (!Number.isFinite(thresholdHours) || thresholdHours <= 0) throw new Error("Invalid customer wait threshold");
  if (policy[0].enabled_at === null) return { intervals: [], open: [], thresholdHours };
  const enabledAt = new Date(Number(policy[0].enabled_at) * 1000);
  const [rows] = await connection.execute<RowDataPacket[]>("SELECT id,wait_key,event_kind,reason,UNIX_TIMESTAMP(occurred_at) occurred_at FROM customer_wait_events WHERE application_id=? ORDER BY occurred_at,id", [applicationId]);
  const events: CustomerWaitEvent[] = rows.map(row => {
    const kind = row.event_kind === "PAUSE" ? "PAUSE" : row.event_kind === "RESUME" ? "RESUME" : null;
    const reason = (["DOCUMENTS_REQUESTED", "AMENDMENT_SENT", "PAYMENT_LINK_ISSUED", "REFUSAL_PENDING_OUTCOME"] as const).find(value => value === row.reason);
    if (!kind || !reason) throw new Error("Invalid customer wait evidence");
    return { id: String(row.id), waitKey: String(row.wait_key), kind, reason, occurredAt: new Date(Number(row.occurred_at) * 1000) };
  });
  return { ...projectCustomerWaits(events, enabledAt, asOf), thresholdHours };
}

export async function overdueWaitingOrders() {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(`SELECT DISTINCT a.id,a.reference_number FROM applications a
    JOIN customer_wait_events e ON e.application_id=a.id WHERE a.status NOT IN ('completed','cancelled','rejected','visa_received','visa_processing')`);
  const now = new Date();
  const items = await Promise.all(rows.map(async row => {
    const waits = await customerWaitLog(Number(row.id), now);
    const oldest = waits.open[0];
    if (!oldest || +now - +oldest.startedAt <= waits.thresholdHours * 3_600_000) return null;
    return { applicationId: Number(row.id), referenceNumber: String(row.reference_number), pausedSince: oldest.startedAt.toISOString(),
      reasons: [...new Set(waits.open.map(wait => wait.reason))], thresholdHours: waits.thresholdHours };
  }));
  return items.filter(item => item !== null).sort((a, b) => a.pausedSince.localeCompare(b.pausedSince));
}

export async function customerServiceClock(applicationId: number) {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(`SELECT a.processing_type,
    UNIX_TIMESTAMP(c.documents_completed_at) completed,UNIX_TIMESTAMP(c.authority_submitted_at) submitted
    FROM applications a LEFT JOIN application_service_clocks c ON c.application_id=a.id WHERE a.id=?`, [applicationId]);
  const row = rows[0];
  if (!row || row.completed === null) return { deadline: null, paused: false, submitted: false };
  const asOf = row.submitted === null ? new Date() : new Date(Number(row.submitted) * 1000);
  const waits = await customerWaitLog(applicationId, asOf);
  return { deadline: submissionDeadline(new Date(Number(row.completed) * 1000), row.processing_type === "express", waits.intervals, asOf).toISOString(),
    paused: row.submitted === null && waits.open.length > 0, submitted: row.submitted !== null };
}
