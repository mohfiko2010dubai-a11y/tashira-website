import { refundMoney } from './refund-domain';
type Item = {
  sourceType: string; paymentId?: number | null; securityDepositPaymentId?: string | null;
  requestedAmount: number | string; deduction: { type: string; value?: number | string | null };
};
// Match the persisted DECIMAL precision and ignore item ordering, never the source.
export function refundRequestIdentity(items: readonly Item[]): string {
  return JSON.stringify(items.map(item => ({ sourceType: item.sourceType,
    sourceId: item.sourceType === 'VISA_SERVICE' ? String(item.paymentId) : String(item.securityDepositPaymentId),
    requestedAmount: refundMoney(Number(item.requestedAmount)).toFixed(2), deductionType: item.deduction.type,
    deductionValue: item.deduction.type === 'NONE' ? '0.0000' : Number(item.deduction.value).toFixed(4),
  })).sort((a, b) => `${a.sourceType}:${a.sourceId}`.localeCompare(`${b.sourceType}:${b.sourceId}`)));
}
