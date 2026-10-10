export const SUPPLIER_STAGES = ['SELECTED', 'SENT', 'FILED', 'VISAS_READY', 'REVIEW', 'CLOSED'] as const;
export type SupplierStage = typeof SUPPLIER_STAGES[number];
export const supplierStageLabels: Record<SupplierStage, string> = {
  SELECTED: 'تم اختيار المورد', SENT: 'أُرسلت المستندات للمورد', FILED: 'بانتظار قرار الهجرة',
  VISAS_READY: 'التأشيرات مرفوعة — مراجعة الفاتورة', REVIEW: 'تحتاج مراجعة', CLOSED: 'ملغاة أو مرفوضة',
};
export type SupplierOperation = {
  applicationId: number; reference: string; supplierId: number; supplierName: string;
  product: string; status: string; stage: SupplierStage; applicantCount: number; visaCount: number;
  supplierSentAt: string | null; authorityFiledAt: string | null; followUpAt: string | null;
  externalReference: string | null; isTest: boolean;
  accounting?: { supplierCostAed: string | null; supplierVatAmount: string | null; supplierTotalAed: string | null;
    supplierInvoiceNumber: string | null; supplierPaid: string | null; };
};
