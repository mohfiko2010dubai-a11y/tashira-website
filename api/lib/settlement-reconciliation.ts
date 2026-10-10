import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { stripeRuntimeMode, stripeSecretKey } from './stripe-runtime';
import { parseSettlement, serviceAmountMinor, summarizeSettlements, type SettlementSource } from './settlement-evidence';

type Provider = (source: SettlementSource) => Promise<unknown>;
type Sql = Pool | PoolConnection;
const sourcesSql=`SELECT 'PAYMENT' kind,CAST(p.id AS CHAR) id,p.application_id applicationId,
  p.stripe_payment_intent_id providerId,p.stripe_payment_intent_id paymentIntent,p.amount,p.currency
  FROM payments p WHERE p.application_id=? AND p.status='succeeded'
  UNION ALL SELECT 'REFUND',r.id,p.application_id,r.stripe_refund_id,p.stripe_payment_intent_id,r.refund_amount,r.currency
  FROM refund_items r JOIN payments p ON p.id=r.payment_id JOIN refund_cases c ON c.id=r.refund_case_id
  WHERE p.application_id=? AND c.application_id=p.application_id AND p.status='succeeded'
  AND r.refund_source_type='VISA_SERVICE' AND r.refund_item_status='SUCCEEDED'`;

async function sources(db: Sql, applicationId: number): Promise<SettlementSource[]> {
  const [rows]=await db.execute<RowDataPacket[]>(sourcesSql,[applicationId,applicationId]);
  return rows.map(row=>({kind:row.kind==='REFUND'?'REFUND':'PAYMENT',id:String(row.id),applicationId:Number(row.applicationId),
    providerId: row.providerId===null?'':String(row.providerId),paymentIntent:String(row.paymentIntent),
    amountMinor:serviceAmountMinor(String(row.amount),String(row.currency)),currency:String(row.currency).toUpperCase()}));
}

export const fetchSettlementSource: Provider = async source => {
  const path=source.kind==='PAYMENT'
    ? `payment_intents/${encodeURIComponent(source.providerId)}?expand[]=latest_charge.balance_transaction`
    : `refunds/${encodeURIComponent(source.providerId)}?expand[]=balance_transaction`;
  if(!(source.kind==='PAYMENT'?/^pi_[A-Za-z0-9_]+$/:/^re_[A-Za-z0-9_]+$/).test(source.providerId)) throw new Error('SETTLEMENT_PROVIDER_ID_MISSING');
  const response=await fetch(`https://api.stripe.com/v1/${path}`,{headers:{Authorization:`Bearer ${stripeSecretKey()}`},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('SETTLEMENT_PROVIDER_UNAVAILABLE');
  return response.json();
};

export class SettlementReconciliation {
  private readonly pool: Pool;
  private readonly provider: Provider;
  private readonly mode: ()=> 'TEST'|'LIVE';
  constructor(pool: Pool, provider: Provider=fetchSettlementSource, mode: ()=> 'TEST'|'LIVE'=stripeRuntimeMode) {
    this.pool=pool;this.provider=provider;this.mode=mode;
  }

  async capture(applicationId:number,kind: SettlementSource['kind'],id:string,actor:string) {
    const source=(await sources(this.pool,applicationId)).find(row=>row.kind===kind&&row.id===id);
    if(!source)throw new Error('SETTLEMENT_SOURCE_NOT_SUCCESSFUL');
    const mode=this.mode();
    const evidence=parseSettlement(await this.provider(source),source,mode);
    const connection=await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('SELECT id FROM applications WHERE id=? FOR UPDATE',[applicationId]);
      const current=(await sources(connection,applicationId)).find(row=>row.kind===kind&&row.id===id);
      if(JSON.stringify(current)!==JSON.stringify(source))throw new Error('SETTLEMENT_SOURCE_CHANGED');
      const [existing]=await connection.execute<RowDataPacket[]>('SELECT evidence_sha256 FROM stripe_settlement_evidence WHERE source_kind=? AND source_id=? FOR UPDATE',[kind,id]);
      if(existing[0]){
        if(existing[0].evidence_sha256!==evidence.evidenceSha256)throw new Error('SETTLEMENT_EVIDENCE_CONFLICT');
      }else{
        await connection.execute(`INSERT INTO stripe_settlement_evidence
          (source_kind,source_id,application_id,provider_id,balance_transaction_id,settlement_currency,gross_minor,fee_minor,net_minor,
           exchange_rate,source_amount_minor,source_currency,stripe_mode,evidence_sha256,recorded_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[kind,id,applicationId,source.providerId,evidence.transactionId,evidence.currency,
          evidence.grossMinor,evidence.feeMinor,evidence.netMinor,evidence.exchangeRate,source.amountMinor,source.currency,mode,evidence.evidenceSha256,actor]);
      }
      await connection.commit();
      return {recorded:true as const,replayed:Boolean(existing[0])};
    }catch(error){await connection.rollback();throw error;}finally{connection.release();}
  }

  async report(applicationId:number){
    const connection=await this.pool.getConnection();
    try{
      await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await connection.query('START TRANSACTION READ ONLY');
      const expected=await sources(connection,applicationId);
      const [recorded]=await connection.execute<RowDataPacket[]>('SELECT * FROM stripe_settlement_evidence WHERE application_id=?',[applicationId]);
      const rows=expected.map(source=>{
        const match=recorded.find(row=>row.source_kind===source.kind&&String(row.source_id)===source.id
          &&row.provider_id===source.providerId&&Number(row.source_amount_minor)===source.amountMinor&&row.source_currency===source.currency);
        return {...source,settlement:match?{transactionId:String(match.balance_transaction_id),currency:String(match.settlement_currency),
          grossMinor:Number(match.gross_minor),feeMinor:Number(match.fee_minor),netMinor:Number(match.net_minor),
          exchangeRate:match.exchange_rate===null?null:String(match.exchange_rate)}:null};
      });
      const [supplier]=await connection.execute<RowDataPacket[]>('SELECT supplier_total_aed,supplier_invoice_number,supplier_paid FROM applications WHERE id=?',[applicationId]);
      await connection.commit();
      return {basis:'STRIPE_BALANCE_MOVEMENTS' as const,rows,missing:rows.filter(row=>!row.settlement).length,
        totals:summarizeSettlements(rows.flatMap(row=>row.settlement?[row.settlement]:[])),
        supplier:{totalAed:supplier[0]?.supplier_total_aed==null?null:String(supplier[0].supplier_total_aed),
          invoiceNumber:supplier[0]?.supplier_invoice_number?String(supplier[0].supplier_invoice_number):null,
          paid:supplier[0]?.supplier_paid==='paid'},
        finalProfit:null};
    }catch(error){await connection.rollback();throw error;}finally{connection.release();}
  }
}
