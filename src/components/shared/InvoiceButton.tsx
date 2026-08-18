import { FileText, Download } from 'lucide-react';

interface InvoiceButtonProps {
  invoiceNumber: string;
  referenceNumber: string;
  totalAmountUsd: number;
  exchangeRate: number;
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
    window.open(`/invoices/${encodeURIComponent(props.invoiceNumber)}/view`, '_blank', 'noopener,noreferrer');
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
  return (
    <a
      href={`/invoices/${encodeURIComponent(props.invoiceNumber)}/download`}
      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 transition-all"
    >
      <Download size={14} />
      Download
    </a>
  );
}
