import { TRPCError } from '@trpc/server';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { productCardInput, type ProductCardInput } from '../../contracts/product-card';
import { defaultOperationsPool } from './operations/mysql-query-client';
export async function listProductCards(pool: Pool = defaultOperationsPool()) {
 const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM operational_product_cards ORDER BY kind,name_ar');
 return rows.map(row => productCardInput.parse({serviceCode:row.service_code,expectedVersion:Number(row.version),nameAr:row.name_ar,nameEn:row.name_en,kind:row.kind,durationDays:row.duration_days,entryType:row.entry_type,audience:row.audience,enabled:Boolean(row.enabled),instructions:row.instructions,requiredDocuments:row.required_documents,applicableProducts:typeof row.applicable_products_json==='string'?JSON.parse(row.applicable_products_json):row.applicable_products_json}));
}
export async function saveProductCard(raw: ProductCardInput, actor: string, pool: Pool = defaultOperationsPool()) {
 const input=productCardInput.parse(raw),c=await pool.getConnection();
 try {
  await c.beginTransaction();
  // Stable service registry lock serializes first insert as well as updates.
  await c.execute('INSERT IGNORE INTO visa_product_availability(service_code,is_active) VALUES (?,FALSE)',[input.serviceCode]);
  await c.execute('SELECT service_code FROM visa_product_availability WHERE service_code=? FOR UPDATE',[input.serviceCode]);
  const [rows]=await c.execute<RowDataPacket[]>('SELECT version FROM operational_product_cards WHERE service_code=? FOR UPDATE',[input.serviceCode]);
  if(Number(rows[0]?.version??0)!==input.expectedVersion) throw new TRPCError({code:'CONFLICT',message:'تغيرت بطاقة المنتج. حدّث القائمة ثم راجع التعديل.'});
  if(input.applicableProducts.includes(input.serviceCode)) throw new TRPCError({code:'BAD_REQUEST',message:'لا تربط الإجراء بنفسه. اختر التأشيرات التي ينطبق عليها.'});
  for(const code of input.applicableProducts){const [found]=await c.execute<RowDataPacket[]>("SELECT service_code FROM operational_product_cards WHERE service_code=? AND kind='visa'",[code]);if(!found.length)throw new TRPCError({code:'BAD_REQUEST',message:'إحدى التأشيرات المرتبطة غير موجودة. حدّث القائمة واخترها من جديد.'});}
  const values=[input.nameAr,input.nameEn,input.kind,input.durationDays,input.entryType,input.audience,input.enabled,input.instructions,input.requiredDocuments,JSON.stringify(input.applicableProducts),input.expectedVersion+1,actor];
  if(rows.length) await c.execute('UPDATE operational_product_cards SET name_ar=?,name_en=?,kind=?,duration_days=?,entry_type=?,audience=?,enabled=?,instructions=?,required_documents=?,applicable_products_json=?,version=?,updated_by=?,updated_at=UTC_TIMESTAMP(3) WHERE service_code=?',[...values,input.serviceCode]);
  else await c.execute('INSERT INTO operational_product_cards(name_ar,name_en,kind,duration_days,entry_type,audience,enabled,instructions,required_documents,applicable_products_json,version,updated_by,service_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[...values,input.serviceCode]);
  await c.execute('INSERT INTO operational_product_card_audit(service_code,version,content_json,actor) VALUES (?,?,?,?)',[input.serviceCode,input.expectedVersion+1,JSON.stringify(input),actor]);
  await c.commit();return {version:input.expectedVersion+1};
 }catch(error){await c.rollback();throw error;}finally{c.release();}
}

export async function saveProductSellingPrice(input:{serviceCode:string;processingType:'regular'|'express';expectedVersion:number;amount:string;currency:'AED'|'USD'},actor:string,pool:Pool=defaultOperationsPool()) {
 const c=await pool.getConnection();try{await c.beginTransaction();
 const [product]=await c.execute<RowDataPacket[]>('SELECT service_code FROM operational_product_cards WHERE service_code=? FOR UPDATE',[input.serviceCode]);
 if(!product.length)throw new TRPCError({code:'NOT_FOUND',message:'احفظ بطاقة المنتج أولًا ثم أدخل سعر البيع.'});
 const [rows]=await c.execute<RowDataPacket[]>('SELECT * FROM pricing_rules WHERE service_code=? AND pricing_processing_type=? ORDER BY version DESC LIMIT 1 FOR UPDATE',[input.serviceCode,input.processingType]);
 const old=rows[0];if(Number(old?.version??0)!==input.expectedVersion)throw new TRPCError({code:'CONFLICT',message:'تغير سعر البيع. حدّث البطاقة ثم أعد الحفظ.'});
 await c.execute(`INSERT INTO pricing_rules(service_code,pricing_processing_type,version,supplier_cost,internal_cost,markup,selling_price,minimum_selling_price,pricing_currency,effective_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),?)`,[input.serviceCode,input.processingType,input.expectedVersion+1,old?.supplier_cost??'0',old?.internal_cost??'0',old?.markup??'0',input.amount,input.amount,input.currency,actor]);
 await c.commit();return {version:input.expectedVersion+1};
 }catch(error){await c.rollback();throw error;}finally{c.release();}
}
