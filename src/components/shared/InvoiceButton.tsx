import { FileText, Download } from 'lucide-react';
import { generateInvoicePDF } from './InvoiceGenerator';

interface InvoiceButtonProps {
  invoiceNumber: string;
  referenceNumber: string;
  totalAmount: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  visaType?: string;
  processingType?: string;
  arrivalDate?: string;
  stripePaymentIntentId?: string;
}

export function ViewInvoiceButton(props: InvoiceButtonProps) {
  const handleClick = () => {
    const doc = generateInvoicePDF({
      invoiceNumber: props.invoiceNumber,
      referenceNumber: props.referenceNumber,
      createdAt: new Date().toISOString(),
      customerName: props.customerName || 'Customer',
      customerEmail: props.customerEmail || '',
      customerPhone: props.customerPhone || '',
      visaType: props.visaType || '',
      processingType: props.processingType || '',
      arrivalDate: props.arrivalDate,
      totalAmount: props.totalAmount,
      stripePaymentIntentId: props.stripePaymentIntentId,
    });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A04C] text-white text-sm rounded-lg hover:shadow-md transition-all"
    >
      <FileText size={14} />
      View Invoice
    </button>
  );
}

export function DownloadInvoiceButton(props: InvoiceButtonProps) {
  const handleClick = () => {
    const doc = generateInvoicePDF({
      invoiceNumber: props.invoiceNumber,
      referenceNumber: props.referenceNumber,
      createdAt: new Date().toISOString(),
      customerName: props.customerName || 'Customer',
      customerEmail: props.customerEmail || '',
      customerPhone: props.customerPhone || '',
      visaType: props.visaType || '',
      processingType: props.processingType || '',
      arrivalDate: props.arrivalDate,
      totalAmount: props.totalAmount,
      stripePaymentIntentId: props.stripePaymentIntentId,
    });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 transition-all"
    >
      <Download size={14} />
      Download
    </button>
  );
}
