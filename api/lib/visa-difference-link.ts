import type { RowDataPacket } from 'mysql2/promise';
import { defaultOperationsPool } from './operations/mysql-query-client';
import { stripeSecretKey, stripeRuntimeMode } from './stripe-runtime';
import { recordDifferenceLink } from './manual-visa-change';

async function create(path: string, values: Record<string,string>, key: string): Promise<Record<string,unknown>> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`,{method:'POST',signal:AbortSignal.timeout(15000),
    headers:{Authorization:`Bearer ${stripeSecretKey()}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':key},body:new URLSearchParams(values)});
  if (!response.ok) throw new Error('تعذر إنشاء رابط فرق السعر في Stripe. أعد المحاولة.');
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Stripe response');
  return value as Record<string,unknown>;
}

export async function createVisaDifferenceLink(applicationId: number, quoteId: string, version: number, actorId: number, requiredOwnerId?: number) {
  const [rows] = await defaultOperationsPool().execute<RowDataPacket[]>(`SELECT a.reference_number,q.state,q.difference_minor,q.currency,
    (SELECT e.reason FROM product_substitution_events e WHERE e.application_id=a.id AND e.version=q.version AND e.action='PAYMENT_LINK_ISSUED' ORDER BY e.id DESC LIMIT 1) payment_link
    FROM applications a JOIN visa_change_quotes q ON q.application_id=a.id AND q.version=a.substitution_version
    WHERE a.id=? AND q.id=? AND q.version=? AND a.payment_status='paid' AND q.accepted_at IS NOT NULL`,[applicationId,quoteId,version]);
  const quote = rows[0];
  if (!quote || quote.state !== 'ACCEPTED' || !Number.isSafeInteger(Number(quote.difference_minor)) || Number(quote.difference_minor)<=0 || quote.currency!=='USD') throw new Error('يلزم أن يوافق العميل على فرق السعر أولًا.');
  if (quote.payment_link) return { url: String(quote.payment_link) };
  const price = await create('prices',{currency:'usd',unit_amount:String(quote.difference_minor),'product_data[name]':`Visa change difference ${quote.reference_number}`},`visa-difference-price:${quoteId}`);
  if (typeof price.id !== 'string' || !price.id.startsWith('price_')) throw new Error('Invalid Stripe price');
  const link = await create('payment_links',{'line_items[0][price]':price.id,'line_items[0][quantity]':'1',
    'payment_intent_data[metadata][referenceNumber]':String(quote.reference_number),'payment_intent_data[metadata][visaChangeQuoteId]':quoteId,
    'metadata[visaChangeQuoteId]':quoteId,'restrictions[completed_sessions][limit]':'1'},`visa-difference-link:${quoteId}`);
  if (link.livemode !== (stripeRuntimeMode()==='LIVE') || typeof link.url !== 'string') throw new Error('Invalid Stripe link environment');
  await recordDifferenceLink(applicationId,quoteId,version,actorId,link.url,requiredOwnerId);
  return { url: link.url };
}
