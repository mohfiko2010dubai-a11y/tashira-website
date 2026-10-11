import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { defaultOperationsPool } from './operations/mysql-query-client';
import { verifyManualMovement } from './manual-movement-verification';
import { withCheckoutLock } from './checkout-quote';
import { prepareVisaRefundCreditNote } from './refund-credit-note';
import { issueFinancialDocument } from './financial-document-series';
import type { StripeRefundResult } from './stripe';

export async function prepareManualRefund(decisionId: string) {
  const pool = defaultOperationsPool();
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT d.*,q.difference_minor FROM visa_change_decisions d
    JOIN visa_change_quotes q ON q.id=d.quote_id JOIN applications a ON a.id=q.application_id AND a.substitution_version=q.version
    WHERE d.id=? AND d.state='PENDING' AND d.direction='REFUND'`, [decisionId]);
  if (rows.length !== 1) throw new Error('A current pending refund decision is required');
  const decision = rows[0], applicationId = Number(decision.application_id), amountMinor = Number(decision.amount_minor);
  if (decision.kind === 'SETTLEMENT' && (Number(decision.difference_minor) >= 0 || -Number(decision.difference_minor) !== amountMinor)) throw new Error('Refund must equal the accepted cheaper-product difference');
  const movement = await verifyManualMovement({reference:String(decision.stripe_reference),direction:'REFUND',amountMinor,currency:String(decision.currency)});
  const reserved = await withCheckoutLock(applicationId, async connection => {
    const [current] = await connection.execute<RowDataPacket[]>(`SELECT d.state,q.state quote_state,q.refund_case_id FROM visa_change_decisions d
      JOIN visa_change_quotes q ON q.id=d.quote_id JOIN applications a ON a.id=q.application_id AND a.substitution_version=q.version WHERE d.id=?`, [decisionId]);
    if (current.length !== 1 || current[0].state !== 'PENDING' || !['ACCEPTED','REFUND_PENDING','REFUSED'].includes(String(current[0].quote_state))) throw new Error('The refund proposal changed; refresh before approval');
    const [payments] = await connection.execute<RowDataPacket[]>(`SELECT p.id,p.amount,p.currency FROM payments p
      JOIN invoices i ON i.payment_id=p.id AND i.application_id=p.application_id
      WHERE p.stripe_payment_intent_id=? AND p.application_id=? AND p.status='succeeded'`, [movement.paymentIntentId,applicationId]);
    if (payments.length !== 1 || String(payments[0].currency).toUpperCase() !== movement.currency || Math.round(Number(payments[0].amount)*100) < amountMinor) throw new Error('This refund does not belong to an invoiced payment on this application');
    const paymentId = Number(payments[0].id);
    const [existing] = await connection.execute<RowDataPacket[]>(`SELECT r.*,c.application_id,c.refund_case_status FROM refund_items r JOIN refund_cases c ON c.id=r.refund_case_id WHERE r.stripe_refund_id=?`, [movement.reference]);
    let itemId: string, caseId: string;
    if (existing.length) {
      const item = existing[0];
      if (existing.length !== 1 || Number(item.application_id) !== applicationId || Number(item.payment_id) !== paymentId
        || item.refund_source_type !== 'VISA_SERVICE' || Math.round(Number(item.refund_amount)*100) !== amountMinor
        || String(item.currency).toUpperCase() !== movement.currency || !['PROCESSING','SUCCEEDED'].includes(String(item.refund_item_status))) throw new Error('Existing refund accounting does not match this movement');
      if (item.idempotency_key !== `manual:${movement.reference}` && (item.refund_item_status !== 'SUCCEEDED' || item.refund_case_status !== 'REFUNDED')) throw new Error('The existing refund is still being finalized; reconcile it before linking the amendment');
      itemId=String(item.id);caseId=String(item.refund_case_id);
      const [[count]] = await connection.execute<RowDataPacket[]>('SELECT COUNT(*) count FROM refund_items WHERE refund_case_id=?', [caseId]);
      if (Number(count.count) !== 1) throw new Error('A combined refund case needs separate reconciliation before linking one visa difference');
      const [linkedQuotes] = await connection.execute<RowDataPacket[]>('SELECT id FROM visa_change_quotes WHERE refund_case_id=? AND id<>?', [caseId,decision.quote_id]);
      if (linkedQuotes.length) throw new Error('This refund has already been used for another visa change');
    } else {
      const [[reserved]] = await connection.execute<RowDataPacket[]>("SELECT COALESCE(SUM(refund_amount),0) total FROM refund_items WHERE payment_id=? AND refund_item_status IN ('PENDING','PROCESSING','SUCCEEDED')", [paymentId]);
      if (Math.round(Number(reserved.total)*100)+amountMinor > Math.round(Number(payments[0].amount)*100)) throw new Error('Other recorded refunds reserve this balance; reconcile them before importing another refund');
      itemId=randomUUID();caseId=randomUUID();
      await connection.execute(`INSERT INTO refund_cases(id,application_id,refund_case_status,reason,policy_version,requested_by)
        VALUES(?,?,'PROCESSING',?,'manual-verified-visa-change',?)`, [caseId,applicationId,String(decision.reason),`staff:${decision.requested_by}`]);
      const amount=(amountMinor/100).toFixed(2);
      await connection.execute(`INSERT INTO refund_items(id,refund_case_id,refund_source_type,payment_id,original_amount,requested_amount,refund_deduction_type,deduction_value,refund_amount,currency,refund_item_status,stripe_refund_id,idempotency_key)
        VALUES(?,?,'VISA_SERVICE',?,?,?,'NONE',0,?,?,'PROCESSING',?,?)`, [itemId,caseId,paymentId,payments[0].amount,amount,amount,movement.currency,movement.reference,`manual:${movement.reference}`]);
    }
    if (current[0].refund_case_id && current[0].refund_case_id !== caseId) throw new Error('Another refund is already linked to this quote');
    await connection.execute(`UPDATE visa_change_quotes SET refund_case_id=?,state=IF(state='ACCEPTED','REFUND_PENDING',state) WHERE id=?`, [caseId,decision.quote_id]);
    return {itemId,caseId,paymentId};
  });
  const refund: StripeRefundResult = {id:movement.reference,payment_intent:movement.paymentIntentId,amount:amountMinor,currency:movement.currency.toLowerCase(),status:'succeeded'};
  const {prepared} = await prepareVisaRefundCreditNote(reserved.itemId,refund);
  return {...reserved,applicationId,quoteId:String(decision.quote_id),amount:(amountMinor/100).toFixed(2),currency:movement.currency,refund,prepared};
}

export async function issueManualRefund(connection: PoolConnection, input: Awaited<ReturnType<typeof prepareManualRefund>>, actorId: number) {
  const [items] = await connection.execute<RowDataPacket[]>('SELECT refund_item_status,stripe_refund_id,refund_amount,payment_id FROM refund_items WHERE id=? FOR UPDATE',[input.itemId]);
  const item=items[0];
  if (!item || !['PROCESSING','SUCCEEDED'].includes(String(item.refund_item_status)) || item.stripe_refund_id !== input.refund.id
    || Number(item.payment_id)!==input.paymentId || Number(item.refund_amount)!==Number(input.amount)) throw new Error('Refund evidence changed during approval');
  const document=await issueFinancialDocument(connection,input.prepared);
  if (item.refund_item_status !== 'SUCCEEDED') {
    await connection.execute("UPDATE refund_items SET refund_item_status='SUCCEEDED',failure_category=NULL,failure_message=NULL WHERE id=?",[input.itemId]);
    await connection.execute("UPDATE refund_cases SET refund_case_status='REFUNDED',approved_by=?,approved_at=COALESCE(approved_at,NOW()),completed_at=COALESCE(completed_at,NOW()) WHERE id=?",[`staff:${actorId}`,input.caseId]);
    await connection.execute(`INSERT INTO financial_events(id,application_id,payment_id,financial_event_type,financial_event_amount,financial_event_currency,source_reference,financial_actor_reference)
      VALUES(?,?,?,'REFUND_COMPLETED',?,?,?,?)`,[randomUUID(),input.applicationId,input.paymentId,input.amount,input.currency,input.refund.id,`staff:${actorId}`]);
    const eventId=randomUUID();
    await connection.execute(`INSERT INTO application_timeline_events(id,application_id,payment_id,event_name,event_source,actor_type,actor_reference,resulting_state,summary)
      VALUES(?,?,?,'REFUND_COMPLETED','MANUAL_VISA_CHANGE','ADMIN',?,'REFUNDED','Existing Stripe refund verified and its credit note issued; no second refund executed')`,[eventId,input.applicationId,input.paymentId,`staff:${actorId}`]);
    await connection.execute("INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json) VALUES(?,?,'REFUND_COMPLETED',JSON_OBJECT())",[`timeline:${eventId}`,input.applicationId]);
  }
  return document.number;
}
