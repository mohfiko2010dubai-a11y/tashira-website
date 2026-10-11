import {serviceAmountMinor,type SettlementSource} from './settlement-evidence';
export type AccountingArchive={number:string;issuanceKey:string;paymentId:string;series:string;snapshot:string;intact:boolean};
export type AccountingInvoice={number:string;paymentId:string;amount:string};
export function reconcileSourceDocument(source:SettlementSource,paymentId:string,archives:readonly AccountingArchive[],invoices:readonly AccountingInvoice[]){
  const key=source.kind==='PAYMENT'?`payment:${source.id}`:`refund:${source.providerId}`;
  const matches=archives.filter(row=>row.issuanceKey===key&&row.paymentId===paymentId);
  const missing={status:'MISSING' as const,number:null};
  if(!matches.length)return missing;
  const archive=matches[0];
  const mismatch={status:'MISMATCH' as const,number:archive.number};
  if(matches.length!==1||!archive.intact||!archive.series.endsWith(source.kind==='PAYMENT'?'-INV':'-CN'))return mismatch;
  try{
    const snapshot:unknown=JSON.parse(archive.snapshot);
    if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return mismatch;
    const value=(key:string):unknown=>Reflect.get(snapshot,key);
    const currency=value('currency');
    const amount=value(source.kind==='PAYMENT'?'totalAmount':'amount');
    if(typeof currency!=='string'||currency.toUpperCase()!==source.currency||!['number','string'].includes(typeof amount))return mismatch;
    if(serviceAmountMinor(String(amount),source.currency)!==source.amountMinor)return mismatch;
    const invoiceMatches=invoices.filter(row=>row.paymentId===paymentId);
    if(invoiceMatches.length!==1)return mismatch;
    if(source.kind==='PAYMENT'){
      if(invoiceMatches[0].number!==archive.number||serviceAmountMinor(invoiceMatches[0].amount,source.currency)!==source.amountMinor)return mismatch;
    }else if(value('refundItemId')!==source.id||value('stripeRefundId')!==source.providerId||value('originalInvoiceNumber')!==invoiceMatches[0].number)return mismatch;
    return {status:'MATCHED' as const,number:archive.number};
  }catch{return mismatch;}
}
