export function visaLabel(code: string | null | undefined): string {
  if (!code) return 'لم يُحدّد بعد';
  const match = /^(\d+)days-(single|multiple)$/.exec(code);
  if (match) return `${match[1]} يومًا — ${match[2] === 'single' ? 'دخول مرة واحدة' : 'دخول متعدد'}`;
  if (code === '96hours-transit') return 'ترانزيت 96 ساعة';
  return code;
}
export const applicationStatusLabels: Record<string, string> = {
  submitted: 'تم استلام الطلب', payment_received: 'تم استلام الدفع', documents_pending: 'بانتظار المستندات',
  documents_received: 'تم استلام المستندات', under_review: 'قيد المراجعة', visa_processing: 'قيد المعالجة لدى الجهة',
  visa_received: 'تم استلام التأشيرة', completed: 'مكتمل', rejected: 'مرفوض', cancelled: 'ملغى',
  paid: 'مدفوع', pending: 'بانتظار الدفع', failed: 'فشل الدفع', refunded: 'تم الاسترداد', unpaid: 'غير مدفوع',
};
export function formatFeeMinor(amount: number, currency: string) {
  const formatter = new Intl.NumberFormat('ar-AE', { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** digits);
}

export function formatOperationDate(value: string | Date | null | undefined): string {
  if (!value) return 'غير مسجّل بعد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'تاريخ غير واضح — راجع السجل';
  return new Intl.DateTimeFormat('ar-AE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' }).format(date) + ' (بتوقيت الإمارات)';
}
