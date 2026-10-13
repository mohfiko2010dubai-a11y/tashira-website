import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { defaultOperationsPool } from './operations/mysql-query-client';
import { verifyManualMovement } from './manual-movement-verification';
import { withCheckoutLock } from './checkout-quote';
import { preparePaidInvoice, issueVisaChangeInvoice, type InvoiceIssueData } from './invoice-archive';
import { activeBusinessSettings } from './pricing-engine';
import { sendPaymentSuccessEmail } from './payment-success-email';
import { captureStripeFee } from './stripe-fee';
import { stripeRuntimeMode } from './stripe-runtime';
import { recordTimelineEvent } from './application-timeline';
import { randomUUID } from 'node:crypto';

export async function prepareManualTopUp(decisionId: string) {
  const pool = defaultOperationsPool();
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT d.*,a.reference_number,a.is_test,q.difference_minor,q.quote_json,q.replacement_product,
    f.snapshot_json FROM visa_change_decisions d JOIN applications a ON a.id=d.application_id
    JOIN visa_change_quotes q ON q.id=d.quote_id AND q.version=a.substitution_version
    JOIN invoices i ON i.application_id=a.id AND i.invoice_number=a.invoice_number
    JOIN financial_document_archives f ON f.document_number=i.invoice_number
    WHERE d.id=? AND d.state='PENDING' AND d.kind='SETTLEMENT' AND d.direction='TOP_UP'`, [decisionId]);
  if (rows.length !== 1) throw new Error('The current accepted difference and original invoice are required');
  return prepareTopUpRow(rows[0], { decisionId });
}

export async function prepareAutomaticTopUp(quoteId: string, paymentIntentId: string, referenceNumber: string) {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(`SELECT q.application_id,q.id quote_id,q.difference_minor amount_minor,q.difference_minor,q.currency,
    q.quote_json,q.replacement_product,a.reference_number,a.is_test,f.snapshot_json
    FROM visa_change_quotes q JOIN applications a ON a.id=q.application_id AND a.substitution_version=q.version
    JOIN invoices i ON i.application_id=a.id AND i.invoice_number=a.invoice_number
    JOIN financial_document_archives f ON f.document_number=i.invoice_number
    WHERE q.id=? AND a.reference_number=? AND a.payment_status='paid' AND q.accepted_at IS NOT NULL
      AND q.state IN ('ACCEPTED','PAYMENT_PENDING')`, [quoteId,referenceNumber]);
  if (rows.length !== 1) throw new Error('Accepted current amendment and original invoice required');
  return prepareTopUpRow({ ...rows[0], stripe_reference: paymentIntentId } as RowDataPacket, { quoteId });
}

async function prepareTopUpRow(row: RowDataPacket, source: { decisionId: string } | { quoteId: string }) {
  const applicationId = Number(row.application_id), amountMinor = Number(row.amount_minor);
  if (amountMinor !== Number(row.difference_minor) || amountMinor <= 0 || row.currency !== 'USD') throw new Error('The recorded difference no longer matches its quote');
  const movement = await verifyManualMovement({ reference: String(row.stripe_reference), direction: 'TOP_UP', amountMinor, currency: 'USD' });
  if (movement.metadata.referenceNumber !== row.reference_number || movement.metadata.visaChangeQuoteId !== row.quote_id) {
    throw new Error('This Stripe payment is not linked to this order and visa-change quote. Check its referenceNumber and visaChangeQuoteId metadata before approval.');
  }
  const paymentId = await withCheckoutLock(applicationId, async connection => {
    const [current] = 'decisionId' in source
      ? await connection.execute<RowDataPacket[]>(`SELECT d.state,q.state quote_state,q.payment_id FROM visa_change_decisions d
          JOIN visa_change_quotes q ON q.id=d.quote_id JOIN applications a ON a.id=q.application_id AND a.substitution_version=q.version WHERE d.id=?`, [source.decisionId])
      : await connection.execute<RowDataPacket[]>(`SELECT q.state quote_state,q.payment_id FROM visa_change_quotes q
          JOIN applications a ON a.id=q.application_id AND a.substitution_version=q.version
          WHERE q.id=? AND a.payment_status='paid' AND q.accepted_at IS NOT NULL`, [source.quoteId]);
    if (current.length !== 1 || ('decisionId' in source && current[0].state !== 'PENDING') || !['ACCEPTED','PAYMENT_PENDING'].includes(String(current[0].quote_state))) throw new Error('The settlement changed; refresh before approval');
    const [prior] = await connection.execute<RowDataPacket[]>('SELECT id,application_id,amount,currency FROM payments WHERE stripe_payment_intent_id=?', [movement.paymentIntentId]);
    let id: number;
    if (prior.length) {
      const payment = prior[0];
      if (Number(payment.application_id) !== applicationId || Number(current[0].payment_id) !== Number(payment.id)
        || Math.round(Number(payment.amount) * 100) !== amountMinor || String(payment.currency).toUpperCase() !== 'USD') throw new Error('This Stripe payment is already bound to another payment or quote');
      id = Number(payment.id);
    } else {
      if (current[0].payment_id !== null) throw new Error('This quote already has another payment');
      const [insert] = await connection.execute<ResultSetHeader>("INSERT INTO payments(application_id,stripe_payment_intent_id,amount,currency,status) VALUES(?,?,?,'USD','pending')", [applicationId,movement.paymentIntentId,(amountMinor / 100).toFixed(2)]);
      id = insert.insertId;
      await connection.execute("UPDATE visa_change_quotes SET payment_id=?,state='PAYMENT_PENDING' WHERE id=?", [id,row.quote_id]);
    }
    return id;
  });
  // The original immutable archive supplies customer identity, not a new form or guessed payer.
  const original = (typeof row.snapshot_json === 'string' ? JSON.parse(row.snapshot_json) : row.snapshot_json) as InvoiceIssueData['data'];
  const quote = typeof row.quote_json === 'string' ? JSON.parse(row.quote_json) : row.quote_json;
  const settings = await activeBusinessSettings();
  const fx = Number(quote.exchangeRateToBase);
  if (!original?.referenceNumber || original.referenceNumber !== row.reference_number || !Number.isFinite(fx) || fx <= 0) throw new Error('Invoice identity or exchange-rate snapshot is incomplete');
  const prepared = await preparePaidInvoice(applicationId,paymentId,{
    isTest:Boolean(row.is_test) || stripeRuntimeMode() === 'TEST',vatRate:settings.vatRegistered === 'yes' ? (settings.vatRate ?? '0.00') : '0.00',
    data:{...original,company:{version:settings.version,legalName:settings.legalName,address:settings.address,licence:settings.licence,
      website:settings.website,email:settings.email,phone:settings.phone,logo:settings.logo},
      visaType:`Visa change difference: ${String(row.replacement_product)}`,applicantCount:1,
      unitPriceInBaseCurrency:amountMinor / 100 * fx,exchangeRateToBase:fx,baseCurrency:String(quote.baseCurrency).toUpperCase(),
      totalAmount:amountMinor / 100,currency:'USD',stripePaymentIntentId:movement.paymentIntentId,
      payerName:'Not recorded for this manual payment',payerRelationship:'Not recorded',cardBrand:undefined,cardLast4:undefined},
  });
  return {applicationId,paymentId,quoteId:String(row.quote_id),referenceNumber:String(row.reference_number),recipient:original.customerEmail,paymentIntentId:movement.paymentIntentId,prepared};
}

export async function issueManualTopUp(connection: PoolConnection, input: Awaited<ReturnType<typeof prepareManualTopUp>>) {
  await connection.execute("UPDATE payments SET status='succeeded' WHERE id=? AND application_id=? AND stripe_payment_intent_id=?", [input.paymentId,input.applicationId,input.paymentIntentId]);
  const number = await issueVisaChangeInvoice(connection,input.applicationId,input.paymentId,input.quoteId,input.prepared);
  const eventId = randomUUID();
  await connection.execute(`INSERT INTO application_timeline_events(id,application_id,payment_id,event_name,event_source,actor_type,actor_reference,resulting_state,summary)
    VALUES(?,?,?,'PAYMENT_CONFIRMED','MANUAL_VISA_CHANGE','STRIPE',?,'paid','Verified additional visa-change payment; separate difference invoice issued')`, [eventId,input.applicationId,input.paymentId,input.paymentIntentId]);
  await connection.execute("INSERT INTO transactional_email_jobs(job_key,application_id,template,variables_json) VALUES(?,?,'PAYMENT_SUCCESS',JSON_OBJECT())", [`timeline:${eventId}`,input.applicationId]);
  return number;
}

export async function notifyManualTopUp(input: Awaited<ReturnType<typeof prepareManualTopUp>>, invoiceNumber: string) {
  // Receipt delivery failure does not roll back money already received; its existing email log records retry needs.
  await sendPaymentSuccessEmail({applicationId:input.applicationId,paymentId:input.paymentId,
    recipient:input.recipient,referenceNumber:input.referenceNumber,invoiceNumber,amountPaid:Number(input.prepared.amount),currency:'USD',invoicePdfPath:`archive:${invoiceNumber}`});
  // Reconciliation reads the actual provider settlement; never derive fees from the quote.
  try { await captureStripeFee(input.applicationId,input.paymentId,input.paymentIntentId); }
  catch { await recordTimelineEvent({applicationId:input.applicationId,paymentId:input.paymentId,eventName:'STRIPE_FEE_RECONCILIATION_PENDING',eventSource:'MANUAL_VISA_CHANGE',actorType:'SYSTEM',resultingState:'pending',summary:'Manual difference payment confirmed; settlement fee reconciliation is pending'}); }
}
