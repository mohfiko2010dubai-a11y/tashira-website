import {describe,it,expect} from 'vitest';
import {parseSettlement,serviceAmountMinor,summarizeSettlements,type SettlementSource} from './settlement-evidence';
const source:SettlementSource={kind:'PAYMENT',id:'1',applicationId:1,providerId:'pi_test',paymentIntent:'pi_test',amountMinor:10000,currency:'USD'};
const balance={id:'txn_test',currency:'aed',amount:36700,fee:1200,net:35500,source:'ch_test',exchange_rate:3.67,type:'charge'};
const intent={id:'pi_test',status:'succeeded',livemode:false,amount_received:10000,currency:'usd',latest_charge:{id:'ch_test',payment_intent:'pi_test',paid:true,captured:true,balance_transaction:balance}};
describe('provider settlement evidence',()=>{
  it('uses provider settlement amounts and FX, without estimating from invoice FX',()=>{
    expect(parseSettlement(intent,source,'TEST')).toMatchObject({currency:'AED',grossMinor:36700,feeMinor:1200,netMinor:35500,exchangeRate:'3.67'});
  });
  it('rejects mode, identity, amount and currency mismatches',()=>{
    for(const patch of [{livemode:true},{id:'pi_other'},{amount_received:9999},{currency:'eur'}])expect(()=>parseSettlement({...intent,...patch},source,'TEST')).toThrow('MISMATCH');
  });
  it('requires a captured payment and a correctly related, arithmetically valid movement',()=>{
    for(const patch of [{net:1},{source:'ch_other'},{type:'refund'},{exchange_rate:null}])expect(()=>parseSettlement({...intent,latest_charge:{...intent.latest_charge,balance_transaction:{...balance,...patch}}},source,'TEST')).toThrow('MISMATCH');
    expect(()=>parseSettlement({...intent,latest_charge:{...intent.latest_charge,captured:false}},source,'TEST')).toThrow('MISMATCH');
  });
  it('keeps pending settlement incomplete',()=>{
    expect(()=>parseSettlement({...intent,latest_charge:{...intent.latest_charge,balance_transaction:null}},source,'TEST')).toThrow('PENDING');
  });
  it('accepts only successful refund debit tied to the original payment',()=>{
    const refundSource={...source,kind:'REFUND' as const,id:'refund-id',providerId:'re_test',amountMinor:2000};
    const refund={id:'re_test',status:'succeeded',amount:2000,currency:'usd',payment_intent:'pi_test',balance_transaction:{...balance,source:'re_test',type:'refund',amount:-7340,fee:0,net:-7340}};
    expect(parseSettlement(refund,refundSource,'TEST')).toMatchObject({grossMinor:-7340,netMinor:-7340});
    for(const patch of [{status:'pending'},{payment_intent:'pi_other'},{amount:1000}])expect(()=>parseSettlement({...refund,...patch},refundSource,'TEST')).toThrow('MISMATCH');
  });
  it('parses supported service amounts exactly and refuses unknown minor units',()=>{
    expect(serviceAmountMinor('0.30','USD')).toBe(30);expect(serviceAmountMinor('185.00','AED')).toBe(18500);
    for(const [value,currency] of [['1.001','USD'],['100','JPY'],['-1','USD'],['0','USD']])expect(()=>serviceAmountMinor(value,currency)).toThrow();
  });
  it('separates currencies and never counts duplicate movements',()=>{
    const a=parseSettlement(intent,source,'TEST');
    expect(summarizeSettlements([a,{...a,transactionId:'txn_usd',currency:'USD',grossMinor:100,feeMinor:5,netMinor:95}])).toHaveLength(2);
    expect(()=>summarizeSettlements([a,a])).toThrow('DUPLICATE');
  });
});
