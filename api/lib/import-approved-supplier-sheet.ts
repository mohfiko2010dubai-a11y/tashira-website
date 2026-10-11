import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import source from '../../contracts/approved-supplier-sheet.json';
import { saveProductCard, listProductCards, saveProductSellingPrice } from './product-cards';
import { listSupplierRates, saveSupplierRate } from './supplier-rates';

/** Explicit administrative import. Never runs on application boot or public requests. */
export async function importApprovedSupplierSheet(pool:Pool) {
 const [[identity]]=await pool.query<RowDataPacket[]>('SELECT DATABASE() db');
 if(identity.db!=='tashira_staging')throw new Error('Approved import restricted to staging');
 const actor='owner-approved-main-sheet-2026-10-11';
 for(const product of source.products){
  const old=(await listProductCards(pool)).find(p=>p.serviceCode===product.serviceCode);
  if(!old)await saveProductCard({serviceCode:product.serviceCode,expectedVersion:0,nameAr:product.nameAr,nameEn:product.nameEn,kind:product.kind as 'visa'|'procedure',durationDays:product.durationDays,entryType:product.entryType as 'single'|'multiple'|'not_applicable',audience:product.audience as 'all'|'child',enabled:true,instructions:'',requiredDocuments:'',applicableProducts:[]},actor,pool);
  const [prices]=await pool.execute<RowDataPacket[]>("SELECT id FROM pricing_rules WHERE service_code=? AND pricing_processing_type='regular' LIMIT 1",[product.serviceCode]);
  if(!prices.length){const match=/^(\d+) (AED|USD)$/.exec(product.sourceSelling);if(!match)throw new Error('Unrecognised source selling price');await saveProductSellingPrice({serviceCode:product.serviceCode,processingType:'regular',expectedVersion:0,amount:match[1],currency:match[2] as 'AED'|'USD'},actor,pool);}

 }
 let imported=0,unchanged=0;
 for(const name of [...new Set(source.rates.map(r=>r.supplierName))]){
  const [found]=await pool.execute<RowDataPacket[]>('SELECT id FROM suppliers WHERE name=?',[name]);
  if(found.length>1)throw new TRPCError({code:'CONFLICT',message:'Duplicate supplier name: '+name});
  let id=Number(found[0]?.id);
  if(!id){const [created]=await pool.execute<ResultSetHeader>("INSERT INTO suppliers(name,is_active,notes) VALUES (?,'active',?)",[name,'الجدول الأساسي من الاسعار.xlsx — الأسعار بالدرهم قبل الضريبة']);id=created.insertId;}
  for(const rate of source.rates.filter(r=>r.supplierName===name)){
   const previous=(await listSupplierRates(id,pool)).find(r=>r.serviceCode===rate.serviceCode&&r.processingType===rate.processingType&&r.residenceCategory===rate.residenceCategory);
   if(previous){if(previous.costAed!==rate.costAed)throw new Error('Existing price differs; import will not overwrite it');unchanged++;continue;}
   await saveSupplierRate({supplierId:id,serviceCode:rate.serviceCode,processingType:rate.processingType as 'regular'|'express',residenceCategory:rate.residenceCategory as 'all'|'gcc-resident'|'gcc-accompany',expectedVersion:0,costAed:rate.costAed,vatConfirmed:false,vatStatus:null,vatAmountAed:null,placeOfSupply:'within_uae',active:true,reason:actor+' '+rate.sourceCell},actor,pool);imported++;
  }
 }
 return {imported,unchanged,products:source.products.length,source:'main table only',run:randomUUID()};
}
