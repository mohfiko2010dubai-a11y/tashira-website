import type {RowDataPacket} from 'mysql2/promise';
import {defaultOperationsPool} from './operations/mysql-query-client';
import {currentVisaChangeQuote} from './visa-change-quotes';
import {quoteApplicationPrice} from './pricing-engine';
import {visaChangeAmount} from '../../contracts/visa-change-money';

export async function previewVisaChange(applicationId:number,product:string){
 const pool=defaultOperationsPool();
 const [rows]=await pool.execute<RowDataPacket[]>(`SELECT a.processing_type,p.amount,p.currency,q.quote_json,
 (SELECT new_total_minor FROM visa_change_quotes WHERE application_id=a.id AND state='SETTLED' ORDER BY version DESC LIMIT 1) settled_total
 FROM applications a JOIN checkout_payment_attempts c ON c.application_id=a.id JOIN payments p ON p.application_id=a.id AND p.stripe_payment_intent_id=c.stripe_payment_intent_id
 JOIN checkout_quote_revisions q ON q.id=c.quote_id AND q.application_id=a.id WHERE a.id=? AND a.payment_status='paid' AND p.status='succeeded'`,[applicationId]);
 if(rows.length!==1)throw new Error('لا تتوفر بيانات السعر الأصلي المؤكد لهذا الطلب.');
 const row=rows[0],original=typeof row.quote_json==='string'?JSON.parse(row.quote_json):row.quote_json;
 if(row.processing_type!=='regular'&&row.processing_type!=='express')throw new Error('Invalid processing type');
 const next=await quoteApplicationPrice({serviceCode:product,processingType:row.processing_type,applicantCount:Number(original.applicantCount)});
 return visaChangeAmount(row.settled_total===null?Number(row.amount):Number(row.settled_total)/100,next.totalPrice,String(row.currency),next.currency);
}
export async function visaChangeProgress(applicationId:number){
 const pool=defaultOperationsPool(),quote=await currentVisaChangeQuote(applicationId);
 const [documents]=await pool.execute<RowDataPacket[]>(`SELECT f.document_number,f.series,f.issued_at,
 COALESCE(i.amount,JSON_UNQUOTE(JSON_EXTRACT(f.snapshot_json,'$.amount'))) amount,
 COALESCE(JSON_UNQUOTE(JSON_EXTRACT(f.snapshot_json,'$.currency')),p.currency) currency,
 CASE WHEN f.document_number=a.invoice_number THEN 'ORIGINAL' WHEN f.series LIKE '%-CN' THEN 'CREDIT' ELSE 'DIFFERENCE' END kind
 FROM financial_document_archives f JOIN applications a ON a.id=f.application_id
 JOIN payments p ON p.id=f.payment_id AND p.application_id=a.id LEFT JOIN invoices i ON i.invoice_number=f.document_number AND i.application_id=a.id
 WHERE a.id=? ORDER BY f.issued_at,f.document_number`,[applicationId]);
 const [events]=quote?await pool.execute<RowDataPacket[]>('SELECT action,reason,occurred_at FROM product_substitution_events WHERE application_id=? AND version=? ORDER BY id',[applicationId,quote.version]):[[]];
 const [jobs]=quote?await pool.execute<RowDataPacket[]>('SELECT job_key,job_status,claimed_at,created_at FROM transactional_email_jobs WHERE application_id=? AND job_key IN (?,?)',[applicationId,`substitution:${applicationId}:${quote.version}`,`adjustment-link:${quote.id}`]):[[]];
 return {quote,events:events.map(r=>({action:String(r.action),reason:r.reason?String(r.reason):null,at:new Date(r.occurred_at).toISOString()})),
 mail:jobs.map(r=>({kind:String(r.job_key).startsWith('substitution:')?'PROPOSAL':'LINK',status:String(r.job_status),at:new Date(r.claimed_at||r.created_at).toISOString()})),
 documents:documents.map(r=>({number:String(r.document_number),kind:String(r.kind),amount:r.amount===null?null:Number(r.amount),currency:String(r.currency),issuedAt:new Date(r.issued_at).toISOString()}))};
}
