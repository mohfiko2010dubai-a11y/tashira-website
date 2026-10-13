import type { RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { defaultOperationsPool } from './operations/mysql-query-client';
import { withCheckoutLock } from './checkout-quote';
import { prepareAutomaticTopUp, issueManualTopUp, notifyManualTopUp } from './manual-topup-accounting';
import { retryableFinancialConflict, FinancialFinalizationPending } from './financial-document-series';

/** Verified webhook dispatch plus independent Stripe retrieval prove receipt. */
export async function finalizeAutomaticVisaTopUp(referenceNumber: string, quoteId: string, paymentIntentId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const [existing] = await defaultOperationsPool().execute<RowDataPacket[]>(`SELECT q.state,p.stripe_payment_intent_id,i.invoice_number
      FROM visa_change_quotes q JOIN applications a ON a.id=q.application_id AND a.substitution_version=q.version
      LEFT JOIN payments p ON p.id=q.payment_id AND p.application_id=q.application_id AND p.status='succeeded'
      LEFT JOIN invoices i ON i.payment_id=p.id AND i.application_id=a.id WHERE q.id=? AND a.reference_number=?`, [quoteId,referenceNumber]);
    if (existing[0]?.state === 'SETTLED') {
      if (existing[0].stripe_payment_intent_id !== paymentIntentId || !existing[0].invoice_number) throw new Error('Amendment already settled by another movement');
      return { invoiceNumber: String(existing[0].invoice_number), replay: true };
    }
    try {
      const prepared = await prepareAutomaticTopUp(quoteId,paymentIntentId,referenceNumber);
      const invoiceNumber = await withCheckoutLock(prepared.applicationId, async connection => {
        const [rows] = await connection.execute<RowDataPacket[]>(`SELECT q.state,q.payment_id,q.version,q.replacement_product
          FROM visa_change_quotes q JOIN applications a ON a.id=q.application_id AND a.substitution_version=q.version
          WHERE q.id=? AND a.id=? AND a.payment_status='paid' AND q.accepted_at IS NOT NULL`, [quoteId,prepared.applicationId]);
        const quote = rows[0];
        if (!quote || Number(quote.payment_id) !== prepared.paymentId || !['PAYMENT_PENDING','SETTLED'].includes(String(quote.state))) throw new Error('Amendment changed before payment finalization');
        if (quote.state === 'SETTLED') {
          const [invoices] = await connection.execute<RowDataPacket[]>('SELECT invoice_number FROM invoices WHERE application_id=? AND payment_id=?',[prepared.applicationId,prepared.paymentId]);
          if (invoices.length !== 1) throw new Error('Settled amendment invoice missing');
          return String(invoices[0].invoice_number);
        }
        const number = await issueManualTopUp(connection,prepared);
        await connection.execute("UPDATE visa_change_quotes SET state='SETTLED' WHERE id=?",[quoteId]);
        await connection.execute(`INSERT INTO product_substitution_events(application_id,version,product,action,actor,reason)
          VALUES (?,?,?,'SETTLED','SYSTEM:STRIPE',?)`,[prepared.applicationId,quote.version,quote.replacement_product,`Verified difference payment ${paymentIntentId}; invoice ${number}`]);
        await connection.execute(`INSERT INTO application_timeline_events(id,application_id,event_name,event_source,actor_type,actor_reference,resulting_state,summary)
          VALUES (?,?,'AMENDMENT_SETTLED','STRIPE_WEBHOOK','STRIPE',?,'SETTLED','Visa-change difference received and invoiced automatically')`,[randomUUID(),prepared.applicationId,paymentIntentId]);
        return number;
      });
      await notifyManualTopUp(prepared,invoiceNumber);
      return { invoiceNumber, replay: false };
    } catch (error) {
      if (attempt < 2 && retryableFinancialConflict(error)) continue;
      if (retryableFinancialConflict(error)) throw new FinancialFinalizationPending('Difference invoice finalization needs webhook retry');
      throw error;
    }
  }
  throw new FinancialFinalizationPending('Difference invoice finalization needs webhook retry');
}
