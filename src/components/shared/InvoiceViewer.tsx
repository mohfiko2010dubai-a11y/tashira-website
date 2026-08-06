import { useState, useEffect, useRef } from 'react';
import { FileText, Download, X } from 'lucide-react';
import { generateInvoicePDF } from './InvoiceGenerator';

interface InvoiceViewerProps {
  invoiceNumber: string;
  referenceNumber: string;
  totalAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  visaType: string;
  processingType: string;
  arrivalDate?: string;
  stripePaymentIntentId?: string;
  onClose: () => void;
}

export default function InvoiceViewer({
  invoiceNumber,
  referenceNumber,
  totalAmount,
  customerName,
  customerEmail,
  customerPhone,
  visaType,
  processingType,
  arrivalDate,
  stripePaymentIntentId,
  onClose,
}: InvoiceViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Generate PDF in browser
    const doc = generateInvoicePDF({
      invoiceNumber,
      referenceNumber,
      createdAt: new Date().toISOString(),
      customerName,
      customerEmail,
      customerPhone,
      visaType,
      processingType,
      arrivalDate,
      totalAmountUsd: totalAmount,
      stripePaymentIntentId,
    });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
    setLoading(false);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [invoiceNumber]);

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-[#C9A04C]" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{invoiceNumber}</h3>
              <p className="text-xs text-gray-400">Tax Invoice</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-[#C9A04C] text-white text-sm rounded-lg hover:shadow-md transition-all"
            >
              <Download size={14} />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 bg-gray-50 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Generating PDF...
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={pdfUrl}
              className="w-full h-full"
              title="Invoice PDF"
            />
          )}
        </div>
      </div>
    </div>
  );
}
