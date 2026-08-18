import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Download, FileText, Headphones, Home, MapPinned, ShieldCheck, Timer, X } from 'lucide-react';
import { resetPaymentSuccessViewport } from '@/hooks/usePaymentSuccessViewport';

export function PaymentSuccessExperience({ referenceNumber, invoiceNumber, amountPaid, currency = 'USD', onBackHome }: {
  referenceNumber: string; invoiceNumber: string; amountPaid: number; currency?: string; visaType?: string; processingType?: string; onBackHome?: () => void;
}) {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(true);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string>();
  const [invoicePreviewError, setInvoicePreviewError] = useState(false);
  useLayoutEffect(() => resetPaymentSuccessViewport(headingRef.current, window), []);
  const encodedInvoice = encodeURIComponent(invoiceNumber);
  const invoiceView = `/invoices/${encodedInvoice}/view`;
  const invoiceDownload = `/invoices/${encodedInvoice}/download`;
  const trackingUrl = `/track?ref=${encodeURIComponent(referenceNumber)}&from=payment-confirmation`;

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void fetch(invoiceView, { credentials: 'same-origin', signal: controller.signal })
      .then((response) => {
        if (!response.ok || response.headers.get('content-type') !== 'application/pdf') throw new Error('Invoice preview unavailable');
        return response.blob();
      })
      .then((invoicePdf) => {
        objectUrl = URL.createObjectURL(invoicePdf);
        setInvoicePreviewUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setInvoicePreviewError(true);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoiceView]);

  const backToHome = () => {
    onBackHome?.();
    navigate('/', { replace: true });
  };

  return <div className="fixed inset-0 z-[100] min-h-screen overflow-y-auto bg-gradient-to-b from-[#F7F7F2] to-white">
    <header className="border-b border-gray-200 bg-white px-4 py-3 sm:px-8"><div className="mx-auto flex max-w-[1280px] items-center justify-between">
      <button type="button" onClick={backToHome} className="text-xl font-bold tracking-[0.22em] text-[#172235]">TASHIRA</button>
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><ShieldCheck size={15}/>Secure confirmation</span>
    </div></header>
    <main className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className={`mx-auto grid max-w-[1280px] gap-6 ${invoiceOpen ? 'lg:grid-cols-[minmax(0,0.44fr)_minmax(0,0.56fr)]' : 'lg:max-w-3xl'}`}>
        {invoiceOpen && <aside className="order-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:order-1">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div className="flex items-center gap-2 text-[#172235]"><FileText size={18} className="text-[#C9A04C]"/><h2 className="font-bold">Invoice Preview</h2></div><button type="button" onClick={() => setInvoiceOpen(false)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close invoice preview"><X size={18}/></button></div>
          <div className="hidden h-[520px] bg-gray-100 lg:block">
            {invoicePreviewUrl ? <iframe title={`Invoice ${invoiceNumber}`} src={invoicePreviewUrl} className="h-full w-full" /> : <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-500">{invoicePreviewError ? 'Preview unavailable. Please use Download Invoice.' : 'Loading secure invoice preview…'}</div>}
          </div>
          <div className="p-5 lg:hidden"><p className="text-sm text-gray-600">Your secure invoice is ready to view or download.</p><a href={invoiceView} target="_blank" rel="noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#C9A04C] px-4 py-3 text-sm font-semibold text-[#9C792D]"><FileText size={16}/>View Invoice</a></div>
          <div className="border-t border-gray-100 p-4"><a href={invoiceDownload} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#172235] px-4 py-3 text-sm font-semibold text-white"><Download size={16}/>Download {invoiceNumber}</a></div>
        </aside>}
        <section className="order-1 flex flex-col justify-center rounded-2xl border border-gray-200 bg-white p-6 shadow-lg sm:p-8 lg:order-2 lg:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"><CheckCircle size={32} className="text-emerald-600"/></div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Payment confirmed</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-3xl font-bold text-[#172235] outline-none sm:text-4xl">Payment Successful</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600">Your application has been received and payment was successful.<br/>It is ready for the next processing stage.</p>
          <div className="mt-6 grid gap-3 rounded-xl bg-gray-50 p-4 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-gray-400">Application Reference</p><p className="mt-1 font-mono font-semibold text-[#172235]">{referenceNumber}</p></div><div><p className="text-xs text-gray-400">Invoice Number</p><p className="mt-1 font-mono font-semibold text-[#172235]">{invoiceNumber}</p></div><div><p className="text-xs text-gray-400">Amount Paid</p><p className="mt-1 font-semibold text-[#172235]">{currency} {amountPaid.toFixed(2)}</p></div><div><p className="text-xs text-gray-400">Status</p><p className="mt-1 font-semibold text-emerald-700">Paid / Ready for Processing</p></div>
          </div>
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800"><CheckCircle size={15} className="mt-0.5 shrink-0"/>A confirmation email with your invoice has been sent to your email address.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><a href={trackingUrl} className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-4 py-3 text-sm font-bold text-white shadow-sm"><MapPinned size={16}/>Track Application</a><a href={invoiceDownload} className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-[#172235]"><Download size={16}/>Download Invoice</a><button type="button" onClick={backToHome} className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600"><Home size={16}/>Back to Home</button></div>
          {!invoiceOpen && <button type="button" onClick={() => setInvoiceOpen(true)} className="mt-4 self-start text-sm font-semibold text-[#9C792D] hover:underline">View secure invoice preview</button>}
        </section>
      </div>
      <section className="mx-auto mt-6 grid max-w-[1280px] grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Customer assurances">
        {[[ShieldCheck,'Secure Payment','Your payment is secure and encrypted.'],[Timer,'Fast Processing','We process your application as quickly as possible.'],[Headphones,'24/7 Support','Our support team is available to assist you.'],[FileText,'Data Protection','Your data is protected and handled securely.']].map(([Icon,title,description]) => <div key={String(title)} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><Icon size={18} className="text-[#C9A04C]"/><h2 className="mt-2 text-sm font-bold text-[#172235]">{String(title)}</h2><p className="mt-1 text-xs leading-5 text-gray-500">{String(description)}</p></div>)}
      </section>
    </main>
  </div>;
}
