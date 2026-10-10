import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, type Pool, type ResultSetHeader } from 'mysql2/promise';
import type { TrpcContext } from './context';
import { businessRouter } from './business-router';
const url=process.env.OPS_REHEARSAL_DATABASE_URL;
describe.skipIf(!url).sequential('pricing margin currency in disposable MySQL',()=>{
  let pool:Pool;
  const admin:TrpcContext={req:new Request('https://synthetic.invalid'),resHeaders:new Headers(),isAdmin:true,customerApplicationReferences:new Set()};
  beforeAll(async()=>{
    const target=new URL(url!);
    if(target.protocol!=='mysql:'||!['127.0.0.1','localhost'].includes(target.hostname)||target.port!=='33306'||!/^\/tashira_ops_rehearsal_[a-z0-9_]+$/.test(target.pathname)||process.env.DATABASE_URL!==url)throw new Error('Disposable database required for both fixture and router');
    pool=createPool({uri:url,connectionLimit:3});
  });
  afterAll(async()=>{await pool?.end();});
  it('converts total quote costs once, excludes test cases, and denies employee access',async()=>{
    const caller=businessRouter.createCaller(admin);
    const before=await caller.cockpit();expect(before.currency).toBe('AED');
    const tag=randomUUID().slice(0,8);
    const [rule]=await pool.execute<ResultSetHeader>(`INSERT INTO pricing_rules(service_code,pricing_processing_type,version,supplier_cost,internal_cost,markup,selling_price,minimum_selling_price,pricing_currency,effective_at,created_by) VALUES (?,'regular',1,25,5,70,100,100,'USD','2020-01-01','synthetic-ci')`,['FIN_'+tag]);
    async function add(isTest:boolean, baseCurrency='AED'){
      const [app]=await pool.execute<ResultSetHeader>(`INSERT INTO applications(reference_number,base_type,residence_type,visa_type,processing_type,contact_email,contact_phone,exchange_rate,total_amount_aed,status,payment_status,data_classification,is_test) VALUES (?,'family','non-gcc',?,'regular','finance@example.invalid','000',3.67,734,'payment_received','paid',?,?)`,['FIN-'+randomUUID(),'FIN_'+tag,isTest?'TEST':'LIVE',isTest?1:0]);
      await pool.execute(`INSERT INTO application_price_snapshots(id,application_id,pricing_rule_id,pricing_version,applicant_count,unit_price,total_price,snapshot_supplier_cost,snapshot_internal_cost,snapshot_markup,snapshot_minimum_selling_price,snapshot_currency,exchange_rate_to_base,snapshot_base_currency,total_in_base_currency) VALUES (?,?,?,1,2,100,200,50,10,140,200,'USD',3.67,?,734)`,[randomUUID(),app.insertId,rule.insertId,baseCurrency]);
    }
    await add(false);await add(true);await add(false,'EUR');
    const result=await caller.cockpit();
    expect(result.calculationBasis).toBe('PRICING_ESTIMATE');
    expect(result.revenue-before.revenue).toBeCloseTo(734,2);
    expect(result.supplierCost-before.supplierCost).toBeCloseTo(183.5,2);
    expect(result.internalCost-before.internalCost).toBeCloseTo(36.7,2);
    expect(result.grossProfit-before.grossProfit).toBeCloseTo(513.8,2);
    expect(result.excludedOtherBaseCurrencyOrders-before.excludedOtherBaseCurrencyOrders).toBe(1);
    await expect(businessRouter.createCaller({...admin,isAdmin:false,staffId:999999}).cockpit()).rejects.toMatchObject({code:'FORBIDDEN'});
  });
});
