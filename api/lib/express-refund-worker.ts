import { eq } from 'drizzle-orm';
import { refundCases } from '@db/schema';
import { getDb } from '../queries/connection';
import { createExpressGuaranteeRefund, processingGuarantees } from './express-guarantee-refund';
import { executeApprovedRefund } from './execute-refund';

let running = false;
export async function runExpressRefunds(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (const order of await processingGuarantees()) {
      if (!order.express || !order.covered || !order.paid || !order.breached) continue;
      try {
        const claim = await createExpressGuaranteeRefund(order.applicationId, 'SYSTEM:EXPRESS_GUARANTEE');
        const [entry] = await getDb().select().from(refundCases).where(eq(refundCases.id, claim.refundCaseId)).limit(1);
        if (entry?.status === 'APPROVED' && entry.approvedBy === 'SYSTEM:EXPRESS_GUARANTEE') await executeApprovedRefund(entry.id, 'SYSTEM:EXPRESS_GUARANTEE');
      } catch { console.error('[Express guarantee] Refund requires review', { applicationId: order.applicationId }); }
    }
  } finally { running = false; }
}
export function startExpressRefundWorker(): void {
  const tick = () => { void runExpressRefunds().catch(() => console.error('[Express guarantee] Worker unavailable; review pending guarantees')); };
  const timer = setInterval(tick, 60_000); timer.unref(); tick();
}
