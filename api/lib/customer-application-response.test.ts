import {it,expect} from 'vitest';
import {customerApplicationResponse} from './customer-application-response';
it('removes supplier commercial values and the supplier object without mutating the internal record',()=>{
 const source={id:1,totalAmountUsd:'185.00',supplierCostAed:'100',supplierTotalAed:'105',supplierInvoiceNumber:'PRIVATE',supplierNotes:'INTERNAL',supplierPaid:'paid',supplier:{email:'supplier@example.invalid',notes:'PRIVATE'},applicants:[{id:2,fullName:'Synthetic'}]};
 const visible=customerApplicationResponse(source);
 expect(visible).toMatchObject({id:1,totalAmountUsd:'185.00',supplier:null,supplierCostAed:null,supplierTotalAed:null,supplierInvoiceNumber:null,supplierNotes:null,supplierPaid:null,applicants:source.applicants});
 expect(JSON.stringify(visible)).not.toMatch(/PRIVATE|INTERNAL|supplier@example/);expect(source.supplierCostAed).toBe('100');
});
