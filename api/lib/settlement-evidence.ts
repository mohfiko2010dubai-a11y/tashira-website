import { createHash } from 'node:crypto';
import { z } from 'zod';

export type SettlementSource = { kind: 'PAYMENT' | 'REFUND'; id: string; applicationId: number;
  providerId: string; paymentIntent: string; amountMinor: number; currency: string };
const integer = z.number().int().safe();
const transaction = z.object({ id: z.string().regex(/^txn_[A-Za-z0-9_]+$/), currency: z.string().regex(/^[a-z]{3}$/),
  amount: integer, fee: integer, net: integer, source: z.string(),
  exchange_rate: z.number().finite().positive().nullable(), type: z.string() });
export type SettlementEvidence = { transactionId: string; currency: string; grossMinor: number; feeMinor: number;
  netMinor: number; exchangeRate: string | null; evidenceSha256: string };

/** Current service prices use two-decimal USD/AED. Unknown units must never be guessed. */
export function serviceAmountMinor(amount: string, currency: string): number {
  if (!['USD', 'AED'].includes(currency.toUpperCase()) || !/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error('SETTLEMENT_SOURCE_AMOUNT_INVALID');
  const [whole, fraction=''] = amount.split('.');
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('SETTLEMENT_SOURCE_AMOUNT_INVALID');
  return value;
}

export function parseSettlement(value: unknown, source: SettlementSource, mode: 'TEST' | 'LIVE'): SettlementEvidence {
  try {
    let balance: unknown;
    let balanceSource: string;
    if (source.kind === 'PAYMENT') {
      const intent = z.object({ id:z.string(), status:z.literal('succeeded'), livemode:z.boolean(),
        amount_received:integer, currency:z.string(), latest_charge:z.object({ id:z.string().regex(/^ch_/),
          payment_intent:z.string(), paid:z.literal(true), captured:z.literal(true), balance_transaction:z.unknown() }) }).parse(value);
      if (intent.id !== source.providerId || intent.id !== source.paymentIntent || intent.amount_received !== source.amountMinor
        || intent.currency.toUpperCase() !== source.currency || intent.livemode !== (mode === 'LIVE')
        || intent.latest_charge.payment_intent !== intent.id) throw new Error();
      balance=intent.latest_charge.balance_transaction; balanceSource=intent.latest_charge.id;
    } else {
      const refund=z.object({ id:z.string(), status:z.literal('succeeded'), amount:integer, currency:z.string(),
        payment_intent:z.string(), balance_transaction:z.unknown() }).parse(value);
      // Refund objects have no livemode field. The authenticated provider client fixes the mode.
      if(refund.id!==source.providerId || refund.payment_intent!==source.paymentIntent || refund.amount!==source.amountMinor
        || refund.currency.toUpperCase()!==source.currency) throw new Error();
      balance=refund.balance_transaction; balanceSource=refund.id;
    }
    if (balance === null || typeof balance === 'string') throw new Error('SETTLEMENT_PENDING');
    const row=transaction.parse(balance);
    if(row.source!==balanceSource || row.net!==row.amount-row.fee
      || (source.kind==='PAYMENT' ? row.amount<=0 || !['charge','payment'].includes(row.type) : row.amount>=0 || !['refund','payment_refund'].includes(row.type))) throw new Error();
    if(row.currency.toUpperCase()===source.currency && Math.abs(row.amount)!==source.amountMinor) throw new Error();
    if(row.currency.toUpperCase()!==source.currency && row.exchange_rate===null) throw new Error();
    const evidence={transactionId:row.id,currency:row.currency.toUpperCase(),grossMinor:row.amount,feeMinor:row.fee,
      netMinor:row.net,exchangeRate:row.exchange_rate===null?null:String(row.exchange_rate)};
    const evidenceSha256=createHash('sha256').update(JSON.stringify({source,mode,...evidence})).digest('hex');
    return {...evidence,evidenceSha256};
  } catch(error) {
    if(error instanceof Error && error.message==='SETTLEMENT_PENDING') throw error;
    throw new Error('SETTLEMENT_EVIDENCE_MISMATCH');
  }
}

export function summarizeSettlements(rows: readonly Pick<SettlementEvidence,'transactionId'|'currency'|'grossMinor'|'feeMinor'|'netMinor'>[]) {
  const seen=new Set<string>();
  const totals=new Map<string,{currency:string;grossMinor:number;feeMinor:number;netMinor:number}>();
  for(const row of rows){
    if(seen.has(row.transactionId)) throw new Error('SETTLEMENT_DUPLICATE_TRANSACTION');
    seen.add(row.transactionId);
    const total=totals.get(row.currency)??{currency:row.currency,grossMinor:0,feeMinor:0,netMinor:0};
    for(const key of ['grossMinor','feeMinor','netMinor'] as const){total[key]+=row[key];if(!Number.isSafeInteger(total[key]))throw new Error('SETTLEMENT_TOTAL_OVERFLOW');}
    totals.set(row.currency,total);
  }
  return [...totals.values()].sort((a,b)=>a.currency.localeCompare(b.currency));
}
