import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {createPool,type Pool,type ResultSetHeader} from 'mysql2/promise';
import {SettlementReconciliation} from './lib/settlement-reconciliation';
import type {SettlementSource} from './lib/settlement-evidence';
const url=process.env.OPS_REHEARSAL_DATABASE_URL;
describe.skipIf(!url).sequential('settlement reconciliation in disposable MySQL',()=>{
  let pool:Pool;
  beforeAll(()=>{
    const target=new URL(url!);
    if(target.protocol!=='mysql:'||!['127.0.0.1','localhost'].includes(target.hostname)||target.port!=='33306'||!/^\/tashira_ops_rehearsal_[a-z0-9_]+$/.test(target.pathname))throw new Error('Disposable database required');
    pool=createPool({uri:url,connectionLimit:4});
  });
  afterAll(async()=>{await pool?.end();});
  async function fixture(){
    const [app]=await pool.execute<ResultSetHeader>(`INSERT INTO applications(reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status,data_classification,is_test) VALUES (?,'single','non-gcc','30days-single','regular','settlement@example.invalid','000',3.67,367,'payment_received','paid','TEST',1)`,['SET-'+randomUUID()]);
    const intent='pi_'+randomUUID().replaceAll('-','');
    const [payment]=await pool.execute<ResultSetHeader>(`INSERT INTO payments(application_id,stripe_payment_intent_id,amount,currency,status) VALUES (?,?,'100.00','USD','succeeded')`,[app.insertId,intent]);
    return {applicationId:app.insertId,paymentId:String(payment.insertId),intent};
  }
  function provider(source:SettlementSource){
    const balance={id:'txn_'+source.providerId,currency:'aed',amount:source.kind==='PAYMENT'?36700:-7340,fee:source.kind==='PAYMENT'?1200:0,net:source.kind==='PAYMENT'?35500:-7340,source:source.kind==='PAYMENT'?'ch_'+source.providerId:source.providerId,exchange_rate:3.67,type:source.kind==='PAYMENT'?'charge':'refund'};
    return Promise.resolve(source.kind==='PAYMENT'?{id:source.providerId,status:'succeeded',livemode:false,amount_received:source.amountMinor,currency:source.currency.toLowerCase(),latest_charge:{id:balance.source,payment_intent:source.paymentIntent,paid:true,captured:true,balance_transaction:balance}}
      :{id:source.providerId,status:'succeeded',amount:source.amountMinor,currency:source.currency.toLowerCase(),payment_intent:source.paymentIntent,balance_transaction:balance});
  }
  it('records concurrent/replayed payments once and subtracts successful refund movements',async()=>{
    const f=await fixture();const service=new SettlementReconciliation(pool,provider,()=> 'TEST');
    await pool.execute(`INSERT INTO payments(application_id,stripe_payment_intent_id,amount,currency,status) VALUES (?,?,'100.00','USD','failed')`,[f.applicationId,'pi_failed_'+randomUUID().replaceAll('-','')]);
    expect((await service.report(f.applicationId)).missing).toBe(1);
    const results=await Promise.all([1,2].map(()=>service.capture(f.applicationId,'PAYMENT',f.paymentId,'synthetic-ci')));
    expect(results.filter(row=>row.replayed)).toHaveLength(1);
    const caseId=randomUUID(),itemId=randomUUID();
    await pool.execute(`INSERT INTO refund_cases(id,application_id,refund_case_status,reason,policy_version,requested_by) VALUES (?,?,'REFUNDED','Synthetic','test','synthetic-ci')`,[caseId,f.applicationId]);
    await pool.execute(`INSERT INTO refund_items(id,refund_case_id,refund_source_type,payment_id,original_amount,requested_amount,refund_deduction_type,deduction_value,refund_amount,currency,refund_item_status,stripe_refund_id,idempotency_key) VALUES (?,?,'VISA_SERVICE',?,100,20,'NONE',0,20,'USD','SUCCEEDED',?,?)`,[itemId,caseId,f.paymentId,'re_'+randomUUID().replaceAll('-',''),randomUUID()]);
    expect((await service.report(f.applicationId)).missing).toBe(1);
    await service.capture(f.applicationId,'REFUND',itemId,'synthetic-ci');
    const report=await service.report(f.applicationId);
    expect(report.missing).toBe(0);expect(report.totals).toEqual([{currency:'AED',grossMinor:29360,feeMinor:1200,netMinor:28160}]);
    expect(report.supplier.totalAed).toBeNull();expect(report.finalProfit).toBeNull();
    await expect(pool.execute('UPDATE stripe_settlement_evidence SET net_minor=0 WHERE application_id=?',[f.applicationId])).rejects.toThrow('immutable');
  });
  it('rejects a changed source during provider lookup and another application target',async()=>{
    const f=await fixture(),other=await fixture();
    const service=new SettlementReconciliation(pool,async source=>{await pool.execute("UPDATE payments SET amount=101 WHERE id=?",[f.paymentId]);return provider(source);},()=> 'TEST');
    await expect(service.capture(f.applicationId,'PAYMENT',f.paymentId,'synthetic-ci')).rejects.toThrow('SOURCE_CHANGED');
    await expect(service.capture(other.applicationId,'PAYMENT',f.paymentId,'synthetic-ci')).rejects.toThrow('NOT_SUCCESSFUL');
    expect((await service.report(f.applicationId)).missing).toBe(1);
  });
  it('rejects mismatched TEST evidence without creating a financial record',async()=>{
    const f=await fixture();const service=new SettlementReconciliation(pool,provider,()=> 'LIVE');
    await expect(service.capture(f.applicationId,'PAYMENT',f.paymentId,'synthetic-ci')).rejects.toThrow('MISMATCH');
    expect((await service.report(f.applicationId)).totals).toEqual([]);
  });
});
