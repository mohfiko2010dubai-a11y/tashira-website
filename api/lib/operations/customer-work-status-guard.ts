import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { WorkState } from '../../../contracts/work-queue';
import { customerWaitLog } from '../customer-wait-log';
import { customerWorkState } from './customer-work-state';

/** A status save cannot release a separate outstanding customer requirement. */
export async function guardReadyCustomerWork(connection: PoolConnection, applicationId: number, status: string, next: WorkState): Promise<WorkState> {
  if (next !== 'READY' || status === 'visa_received') return next;
  const waits = await customerWaitLog(applicationId, new Date(), connection);
  const [quotes] = await connection.execute<RowDataPacket[]>(`SELECT q.id,q.state,q.difference_minor,
    EXISTS(SELECT 1 FROM product_substitution_events e WHERE e.application_id=q.application_id AND e.version=q.version AND e.action='PAYMENT_LINK_ISSUED') linked,
    EXISTS(SELECT 1 FROM product_substitution_events e WHERE e.application_id=q.application_id AND e.version=q.version AND e.action='REFUSAL_RESOLVED') resolved
    FROM visa_change_quotes q JOIN applications a ON a.id=q.application_id AND a.substitution_version=q.version WHERE a.id=?`, [applicationId]);
  const row = quotes[0];
  return customerWorkState({ status, open: waits.open, quote: row ? { id: String(row.id), state: String(row.state), difference: Number(row.difference_minor),
    paymentLinkIssued: Boolean(row.linked), refusalResolved: Boolean(row.resolved) } : null }, next);
}
