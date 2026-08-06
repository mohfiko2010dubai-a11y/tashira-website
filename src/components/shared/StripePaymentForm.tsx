import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { trpc } from '@/providers/trpc';
import { CreditCard, Lock, CheckCircle, Upload, FolderOpen, AlertCircle, Loader2 } from 'lucide-react';
import { ViewInvoiceButton, DownloadInvoiceButton } from './InvoiceButton';
import type { PendingFile, UploadProgress } from '@/hooks/useDocumentUpload';

// Google Ads Conversion Tracking
function trackConversion(eventName: string, value?: number, currency?: string) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, {
      send_to: 'AW-XXXXXXXXXX', // Replace with your Google Ads Conversion ID
      value: value || 0,
      currency: currency || 'USD',
    });
  }
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const cardStyle = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1A2332',
      '::placeholder': { color: '#aab7c4' },
      padding: '12px',
    },
    invalid: { color: '#fa755a' },
  },
};

interface PaymentFormInnerProps {
  amount: number;
  referenceNumber: string;
  applicantData: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    passportNumber?: string;
    nationality?: string;
    visaType: string;
    processingType: string;
    arrivalDate?: string;
  };
  onSuccess: (invoiceNumber: string) => void;
  onClose: () => void;
}

function PaymentFormInner({
  amount,
  referenceNumber,
  onSuccess,
  onClose,
}: PaymentFormInnerProps) {
  const currency = 'USD';
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createIntent = trpc.payment.createIntent.useMutation();
  const confirmPayment = trpc.payment.confirm.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Google Ads: Begin checkout conversion
    trackConversion('begin_checkout', amount, currency);
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');

    try {
      const intentResult = await createIntent.mutateAsync({
        amount: amount * 100,
        currency: 'usd',
        referenceNumber,
      });

      if (intentResult.error || !intentResult.clientSecret) {
        throw new Error(intentResult.error || 'Failed to create payment intent');
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        intentResult.clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
            billing_details: { name: 'Tashira Customer' },
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        await confirmPayment.mutateAsync({
          referenceNumber,
          paymentIntentId: paymentIntent.id,
        });
        // Google Ads: Purchase conversion (replace AW-XXXXXXXXXX with your real Conversion ID)
        trackConversion('purchase', amount, currency);
        onSuccess(`INV-${referenceNumber}`);
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Test Mode - No real charges</p>
        <p className="text-[10px] text-amber-500">Use card: 4242 4242 4242 4242 | Any future date | Any 3 digits</p>
      </div>

      <div className="bg-gradient-to-r from-[#C9A04C]/10 to-[#C9A04C]/5 border border-[#C9A04C]/20 rounded-xl p-4 text-center">
        <p className="text-sm text-gray-500 mb-1">Total Amount</p>
        <p className="text-3xl font-bold text-[#C9A04C]">${amount}</p>
        <p className="text-xs text-gray-400 mt-1">Ref: {referenceNumber}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <CreditCard size={14} className="text-[#C9A04C]" />
          Card Details
        </label>
        <div className="border border-gray-200 rounded-lg p-3 focus-within:border-[#C9A04C] focus-within:ring-1 focus-within:ring-[#C9A04C] transition-all">
          <CardElement options={{ style: cardStyle.style }} />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Lock size={12} className="text-emerald-500" />
        <span>Secured by Stripe. Your card details are never stored on our servers.</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={!stripe || loading} className="flex-1 px-4 py-3 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50">
          {loading ? 'Processing...' : `Pay $${amount}`}
        </button>
      </div>
    </form>
  );
}

export default function StripePaymentForm(props: PaymentFormInnerProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormInner {...props} />
    </Elements>
  );
}

// ==================== SUCCESS MODAL WITH DOCUMENT UPLOAD ====================
export function PaymentSuccessModal({
  invoiceNumber,
  referenceNumber,
  totalAmountUsd,
  exchangeRate,
  applicationId,
  pendingFiles,
  applicantData,
  onClose,
}: {
  invoiceNumber: string;
  referenceNumber: string;
  totalAmountUsd: number;
  exchangeRate: number;
  applicationId: number;
  pendingFiles: PendingFile[];
  applicantData: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    passportNumber?: string;
    nationality?: string;
    visaType: string;
    processingType: string;
    arrivalDate?: string;
  };
  onClose: () => void;
}) {
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "partial" | "failed">("idle");
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [uploadError, setUploadError] = useState("");

  const storageUpload = trpc.storage.upload.useMutation();
  const docCreate = trpc.document.create.useMutation();

  const handleUploadDocuments = async () => {
    if (pendingFiles.length === 0) return;

    setUploadState("uploading");
    setUploadError("");
    setProgress(
      pendingFiles.map((f) => ({
        fileName: f.file.name,
        status: "pending" as const,
        progress: 0,
      })),
    );

    let uploaded = 0;
    let failed = 0;

    for (let i = 0; i < pendingFiles.length; i++) {
      const pf = pendingFiles[i];

      setProgress((prev) => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: "uploading", progress: 30 };
        return updated;
      });

      try {
        // Read file as base64
        const base64 = await fileToBase64(pf.file);

        setProgress((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], progress: 60 };
          return updated;
        });

        // Upload to Supabase
        const result = await storageUpload.mutateAsync({
          applicationId,
          documentType: pf.documentType,
          fileName: pf.file.name,
          mimeType: pf.file.type,
          fileSize: pf.file.size,
          base64Data: base64.split(",")[1],
          uploadedBy: applicantData.customerEmail,
        });

        setProgress((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], progress: 80 };
          return updated;
        });

        // Create document record
        await docCreate.mutateAsync({
          applicationId,
          documentType: pf.documentType,
          originalFileName: pf.file.name,
          storedFileName: result.storedFileName,
          mimeType: pf.file.type,
          fileSize: pf.file.size,
          storagePath: result.storagePath,
          uploadStatus: "uploaded",
          uploadedBy: applicantData.customerEmail,
        });

        setProgress((prev) => {
          const updated = [...prev];
          updated[i] = { fileName: pf.file.name, status: "success", progress: 100 };
          return updated;
        });

        uploaded++;
      } catch (err: any) {
        console.error(`[Upload] Failed for ${pf.file.name}:`, err.message);
        setUploadError(err.message || "Upload failed. Please try again.");
        setProgress((prev) => {
          const updated = [...prev];
          updated[i] = { fileName: pf.file.name, status: "failed", progress: 0 };
          return updated;
        });
        failed++;
      }
    }

    if (failed === 0) {
      setUploadState("success");
      // Google Ads: Document upload conversion
      trackConversion('submit_application');
    }
    else if (uploaded > 0) setUploadState("partial");
    else setUploadState("failed");
  };

  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle size={32} className="text-emerald-500" />
      </div>
      <h3 className="text-xl font-bold text-gray-900">Payment Successful!</h3>
      <p className="text-sm text-gray-500">
        Your application has been submitted and payment received.
      </p>
      <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-left">
        <p className="text-sm">
          <span className="text-gray-500">Reference:</span>{' '}
          <span className="font-mono font-semibold text-[#C9A04C]">{referenceNumber}</span>
        </p>
        <p className="text-sm">
          <span className="text-gray-500">Invoice:</span>{' '}
          <span className="font-mono font-semibold">{invoiceNumber}</span>
        </p>
        <p className="text-sm">
          <span className="text-gray-500">Amount Paid (USD):</span>{' '}
          <span className="font-semibold">${totalAmountUsd.toFixed(2)}</span>
        </p>
        <p className="text-sm">
          <span className="text-gray-500">Exchange Rate:</span>{' '}
          <span className="font-semibold">{exchangeRate} AED/USD</span>
        </p>
      </div>

      {/* Invoice Buttons */}
      <div className="space-y-2">
        <ViewInvoiceButton
          invoiceNumber={invoiceNumber}
          referenceNumber={referenceNumber}
          totalAmountUsd={totalAmountUsd}
          exchangeRate={exchangeRate}
          customerName={applicantData.customerName}
          customerEmail={applicantData.customerEmail}
          customerPhone={applicantData.customerPhone}
          visaType={applicantData.visaType}
          processingType={applicantData.processingType}
          arrivalDate={applicantData.arrivalDate}
        />
        <DownloadInvoiceButton
          invoiceNumber={invoiceNumber}
          referenceNumber={referenceNumber}
          totalAmountUsd={totalAmountUsd}
          exchangeRate={exchangeRate}
          customerName={applicantData.customerName}
          customerEmail={applicantData.customerEmail}
          customerPhone={applicantData.customerPhone}
          visaType={applicantData.visaType}
          processingType={applicantData.processingType}
          arrivalDate={applicantData.arrivalDate}
        />
      </div>

      {/* Document Upload Section */}
      {pendingFiles.length > 0 && uploadState === "idle" && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen size={16} className="text-amber-600" />
            <h4 className="text-sm font-semibold text-amber-800">Documents Ready for Upload</h4>
          </div>
          <p className="text-xs text-amber-600 mb-3">
            {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""} selected. Click below to upload to secure storage.
          </p>
          <button
            onClick={handleUploadDocuments}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white rounded-lg font-medium hover:shadow-md transition-all"
          >
            <Upload size={16} />
            Upload {pendingFiles.length} Document{pendingFiles.length > 1 ? "s" : ""}
          </button>
        </div>
      )}

      {/* Upload Progress */}
      {uploadState === "uploading" && progress.length > 0 && (
        <div className="space-y-2 text-left">
          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600 mb-2">
              Error: {uploadError}
            </div>
          )}
          <h4 className="text-sm font-semibold text-gray-700">Uploading Documents...</h4>
          {progress.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {p.status === "uploading" && <Loader2 size={12} className="animate-spin text-[#C9A04C]" />}
              {p.status === "success" && <CheckCircle size={12} className="text-emerald-500" />}
              {p.status === "failed" && <AlertCircle size={12} className="text-red-500" />}
              <span className="flex-1 truncate">{p.fileName}</span>
              <span className={`shrink-0 ${
                p.status === "success" ? "text-emerald-600" :
                p.status === "failed" ? "text-red-600" :
                "text-[#C9A04C]"
              }`}>
                {p.status === "success" ? "Done" : p.status === "failed" ? "Failed" : `${p.progress}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Upload Results */}
      {uploadState === "success" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle size={16} />
            All documents uploaded successfully!
          </p>
        </div>
      )}
      {uploadState === "partial" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-700">
            Some uploads failed. You can retry from your application tracking page.
          </p>
        </div>
      )}
      {uploadState === "failed" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">
            Upload failed. Please retry from your application tracking page or contact support.
          </p>
        </div>
      )}

      <button onClick={onClose} className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all">
        Submit Another Application
      </button>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
