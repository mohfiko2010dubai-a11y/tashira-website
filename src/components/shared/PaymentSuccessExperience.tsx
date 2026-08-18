import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Download, FileText, Home, MapPinned, ShieldCheck } from 'lucide-react';
import { resetPaymentSuccessViewport } from '@/hooks/usePaymentSuccessViewport';

export function PaymentSuccessExperience({
  referenceNumber,
  invoiceNumber,
  amountPaid,
  currency = 'USD',
  visaType,
  processingType,
}: {
  referenceNumber: string;
  invoiceNumber: string;
  amountPaid: number;
  currency?: string;
  visaType?: string;
  processingType?: string;
}) {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => resetPaymentSuccessViewport(headingRef.current, window), []);

  const invoiceDownload = `/invoices/${encodeURIComponent(invoiceNumber)}/download`;
  const trackingUrl = `/track?ref=${encodeURIComponent(referenceNumber)}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F7F7F2] to-white px-4 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-[0.78fr_1.22fr] md:items-stretch">
        <aside className="order-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:order-1">
          <div className="flex items-center gap-2 text-[#172235]"><FileText size={18} className="text-[#C9A04C]"/><h2 className="font-bold">Invoice Summary</h2></div>
          <dl className="mt-5 space-y-4 text-sm">
            <div><dt className="text-xs uppercase tracking-wide text-gray-400">Invoice</dt><dd className="mt-1 font-mono font-semibold text-[#172235]">{invoiceNumber}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-gray-400">Application</dt><dd className="mt-1 font-mono font-semibold text-[#172235]">{referenceNumber}</dd></div>
            {visaType && <div><dt className="text-xs uppercase tracking-wide text-gray-400">Service</dt><dd className="mt-1 font-medium text-[#172235]">{visaType}{processingType ? ` · ${processingType}` : ''}</dd></div>}
            <div className="border-t border-gray-100 pt-4"><dt className="text-xs uppercase tracking-wide text-gray-400">Amount paid</dt><dd className="mt-1 text-2xl font-bold text-[#C9A04C]">{currency} {amountPaid.toFixed(2)}</dd></div>
          </dl>
          <a href={invoiceDownload} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-[#C9A04C] px-4 py-3 text-sm font-semibold text-[#9C792D] transition hover:bg-[#C9A04C]/5"><Download size={16}/>Download Invoice</a>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400"><ShieldCheck size={13}/>Authorized customer access is required.</p>
        </aside>

        <section className="order-1 flex flex-col justify-center rounded-2xl border border-gray-200 bg-white p-6 shadow-lg sm:p-8 md:order-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"><CheckCircle size={32} className="text-emerald-600"/></div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Payment confirmed</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-3xl font-bold text-[#172235] outline-none">Payment Successful</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600">Your application has been received and payment was successful. It is ready for the next processing stage.</p>

          <div className="mt-6 grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-gray-400">Application Reference</p><p className="mt-1 font-mono font-semibold text-[#172235]">{referenceNumber}</p></div>
            <div><p className="text-xs text-gray-400">Invoice</p><p className="mt-1 font-mono font-semibold text-[#172235]">{invoiceNumber}</p></div>
            <div><p className="text-xs text-gray-400">Amount Paid</p><p className="mt-1 font-semibold text-[#172235]">{currency} {amountPaid.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-400">Status</p><p className="mt-1 font-semibold text-emerald-700">Paid / Ready for Processing</p></div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <a href={trackingUrl} className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-4 py-3 text-sm font-bold text-white shadow-sm"><MapPinned size={16}/>Track Application</a>
            <a href={invoiceDownload} className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-[#172235]"><Download size={16}/>Download Invoice</a>
            <button type="button" onClick={() => navigate('/', { replace: true })} className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600"><Home size={16}/>Back to Home</button>
          </div>
        </section>
      </div>
    </main>
  );
}
