// Customer endpoints must not expose supplier commercial details, even when the
// customer is correctly authenticated for their own application.
const hiddenSupplierFields={supplier:null,supplierId:null,supplierRateId:null,supplierRateQuantity:null,
  supplierCostAed:null,supplierVatStatus:null,supplierPlaceOfSupply:null,supplierVatAmount:null,supplierTotalAed:null,
  supplierInvoiceNumber:null,supplierPaid:null,supplierNotes:null};
export function customerApplicationResponse<T extends object>(application:T):Omit<T,keyof typeof hiddenSupplierFields>&typeof hiddenSupplierFields{
  return {...application,...hiddenSupplierFields};
}
