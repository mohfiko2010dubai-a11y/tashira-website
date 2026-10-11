import { expect,it,vi } from 'vitest';
import source from '../../contracts/approved-supplier-sheet.json';
import { productCardInput } from '../../contracts/product-card';
vi.mock('./operations/mysql-query-client',()=>({defaultOperationsPool:vi.fn(()=>{throw new Error('No database for unauthorised users');})}));
import { catalogRouter } from '../catalog-router';
it('includes exactly the approved main sheet and keeps residence prices distinct',()=>{
 expect(source.products).toHaveLength(13);expect(source.rates).toHaveLength(49);
 expect(source.rates.find(r=>r.supplierName==='BASHIR'&&r.serviceCode==='60days-multiple')?.costAed).toBe('900.00');
 expect(source.rates.find(r=>r.supplierName==='GDRFA'&&r.serviceCode==='30days-single'&&r.residenceCategory==='gcc-accompany')?.costAed).toBe('208.88');
 expect(source.rates.every(r=>Number(r.costAed)>0)).toBe(true);
});
it('requires meaningful product names and a stable code',()=>{
 expect(productCardInput.safeParse({}).success).toBe(false);
});
it('denies customer and staff access to product cards and selling price edits',async()=>{
 for(const staffId of [undefined,4]){const caller=catalogRouter.createCaller({staffId,isAdmin:false,req:new Request('https://example.invalid'),resHeaders:new Headers(),customerApplicationReferences:new Set()});await expect(caller.productCards()).rejects.toMatchObject({code:'FORBIDDEN'});await expect(caller.saveSellingPrice({serviceCode:'30days-single',processingType:'regular',expectedVersion:0,amount:'185',currency:'USD'})).rejects.toMatchObject({code:'FORBIDDEN'});}
});
