import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';
import { loadStripe } from '@stripe/stripe-js/pure';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  CreditCard, Lock, AlertCircle, Loader2,
  Shield, Clock, FileText, ArrowLeft
} from 'lucide-react';
import { safeStripeFailureCategory, usePaymentTimeline } from '@/hooks/usePaymentTimeline';
import { paymentViewState } from '@/lib/payment-view-state';
import { PaymentSuccessExperience } from '@/components/shared/PaymentSuccessExperience';
import { completionPanelGroups, safeCheckoutErrorMessage } from '@/lib/checkout-preflight';
import { trackVerifiedPaymentConversion } from '@/lib/google-conversion';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

function PaymentForm({ referenceNumber, amount, applicantName, onConfirmed }: {
  referenceNumber: string;
  amount: number;
  visaType: string;
  applicantName: string;
  onConfirmed: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const utils = trpc.useUtils();
  const paymentTimeline = usePaymentTimeline(referenceNumber);
  const { paymentElementLoaded } = paymentTimeline;

  const confirmPayment = trpc.payment.confirm.useMutation();
  const createIntent = trpc.payment.createIntent.useMutation();

  useEffect(() => {
    if (stripe && elements) paymentElementLoaded();
  }, [elements, paymentElementLoaded, stripe]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');
    paymentTimeline.paymentStarted();

    try {
      // Convert amount from dollars to cents for Stripe
      const amountInCents = Math.round(amount * 100);
      
      // Create payment intent via tRPC
      const result = await createIntent.mutateAsync({
        referenceNumber,
        amount: amountInCents,
        currency: 'usd',
      });

      const clientSecret = result.clientSecret;
      if (!clientSecret) {
        throw new Error('Failed to initialize payment');
      }

      // Confirm card payment
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            name: applicantName,
          },
        },
      });

      if (stripeError) {
        paymentTimeline.paymentFailed(safeStripeFailureCategory(stripeError.code));
        setError(stripeError.message || 'Payment failed');
        setLoading(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        // Confirm in backend
        const confirmedPayment = await confirmPayment.mutateAsync({
          referenceNumber,
          paymentIntentId: paymentIntent.id,
        });
        paymentTimeline.paymentConfirmed();
        trackVerifiedPaymentConversion({
          transactionId: confirmedPayment.referenceNumber,
          value: confirmedPayment.totalAmount,
          currency: confirmedPayment.currency,
        });
        await utils.application.getByReference.invalidate({ referenceNumber });
        onConfirmed();
      }
    } catch (err: unknown) {
      paymentTimeline.paymentFailed("unknown");
      setError(safeCheckoutErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[#1A2332] mb-2">
          <CreditCard size={16} className="inline mr-2" />
          Card Details
        </label>
        <div className="border border-gray-200 rounded-lg p-4 focus-within:border-[#C9A04C] focus-within:ring-1 focus-within:ring-[#C9A04C]">
          <CardElement
            options={{
              hidePostalCode: true,
              style: {
                base: {
                  fontSize: '16px',
                  color: '#1A2332',
                  '::placeholder': { color: '#9CA3AF' },
                },
              },
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Shield size={16} className="text-emerald-500" />
        <span>Secure payment powered by Stripe</span>
        <Lock size={14} />
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-4 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock size={18} />
            Pay ${amount || 0}
          </>
        )}
      </button>
    </form>
  );
}

export default function PaymentPage() {
  const { referenceNumber } = useParams<{ referenceNumber: string }>();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);

  // Get application details
  const { data: app, isLoading, error } = trpc.application.getByReference.useQuery(
    { referenceNumber: referenceNumber! },
    { enabled: !!referenceNumber }
  );
  const readiness = trpc.payment.readiness.useQuery(
    { referenceNumber: referenceNumber! },
    { enabled: !!referenceNumber && !!app },
  );
  const stripePromise = useMemo(
    () => readiness.data?.status === 'READY' && stripePublishableKey.startsWith('pk_test_')
      ? loadStripe(stripePublishableKey)
      : null,
    [readiness.data?.status],
  );

  // Debug: log any errors
  useEffect(() => {
    if (error) {
      console.error("[PaymentPage] Error fetching application:", error);
    }
  }, [error]);

  if (isLoading || (!!app && readiness.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="text-[#C9A04C] animate-spin" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#1A2332] mb-2">Application Not Found</h2>
          <p className="text-gray-500 mb-2">The reference number you entered is invalid.</p>
          {error && (
            <p className="text-red-400 text-xs mb-2 font-mono bg-red-50 p-2 rounded">{error.message}</p>
          )}
          <p className="text-gray-400 text-xs mb-4">Ref: {referenceNumber}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-[#C9A04C] text-white rounded-lg hover:bg-[#DDBB7A] transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Calculate amount from visa type if database values are missing
  const visaPrices: Record<string, number> = {
    '14 Days': 145, '30 Days': 170, '60 Days': 250, '90 Days': 330, '96 Hours': 99,
    '14 days': 145, '30 days': 170, '60 days': 250, '90 days': 330, '96 hours': 99,
  };
  const expressFee = app.processingType === 'express' ? 40 : 0;
  const basePrice = visaPrices[app.visaType || ''] || 170;
  const count = app.applicants.length || 1;
  const calculatedAmount = (basePrice + expressFee) * count;
  
  const dbAmount = typeof app.totalAmountUsd === 'string' 
    ? parseFloat(app.totalAmountUsd) 
    : (typeof app.totalAmountAed === 'string' ? parseFloat(app.totalAmountAed) / 3.67 : 0);
  
  const amount = dbAmount > 0 ? dbAmount : calculatedAmount;
  const applicantName = app.contactEmail ? app.contactEmail.split('@')[0] : 'Applicant';
  const completionGroups = readiness.data?.status === 'INCOMPLETE'
    ? completionPanelGroups(readiness.data)
    : [];

  const continueApplication = () => {
    localStorage.setItem('tashira_chatbot_resume', JSON.stringify({
      referenceNumber,
      applicantCount: Math.max(app.applicants.length, 1),
    }));
    navigate('/?resume=1');
  };

  const viewState = paymentViewState({ paymentStatus: app.paymentStatus, browserConfirmed: confirmed, confirmationPending: false });
  if (viewState === 'confirmed') {
    return (
      <PaymentSuccessExperience
        referenceNumber={referenceNumber!}
        invoiceNumber={app.invoiceNumber || `INV-${referenceNumber}`}
        amountPaid={amount}
        currency="USD"
        visaType={app.visaType}
        processingType={app.processingType}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF7] to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-500 hover:text-[#C9A04C] transition-colors"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <h1 className="text-lg font-bold text-[#1A2332]">Secure Payment</h1>
          <div className="flex items-center gap-1 text-emerald-600 text-sm">
            <Lock size={14} />
            <span>SSL</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Order Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#1A2332] mb-4">Order Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Reference</span>
              <span className="font-mono font-medium">{referenceNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Applicant</span>
              <span className="font-medium">{applicantName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Visa Type</span>
              <span className="font-medium">{app.visaType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Processing</span>
              <span className="font-medium">{app.processingType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Applicants</span>
              <span className="font-medium">{app.applicants.length || 1}</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between">
              <span className="font-semibold text-[#1A2332]">Total</span>
              <span className="text-2xl font-bold text-[#C9A04C]">${amount || 0}</span>
            </div>
          </div>
        </div>

        {/* Security Badges */}
        <div className="flex items-center justify-center gap-6 mb-6 text-gray-400">
          <div className="flex items-center gap-1 text-xs">
            <Shield size={14} />
            <span>256-bit SSL</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Clock size={14} />
            <span>Instant Confirmation</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <FileText size={14} />
            <span>Auto Invoice</span>
          </div>
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {readiness.error ? (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              We could not verify that this application is ready for payment. Please refresh the page or contact support.
            </div>
          ) : readiness.data?.status === 'INCOMPLETE' ? (
            <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-950">
              <div className="flex items-start gap-3">
                <AlertCircle size={22} className="mt-0.5 shrink-0 text-amber-700" />
                <div className="flex-1">
                  <h2 className="font-semibold text-lg">Complete your application before payment</h2>
                  <p className="mt-1 text-sm text-amber-800">Your information is saved. Please add the following details and documents:</p>
                  <div className="mt-4 space-y-3">
                    {completionGroups.map((group) => (
                      <div key={group.heading}>
                        <h3 className="text-sm font-semibold">{group.heading}</h3>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-800">
                          {group.items.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={continueApplication}
                    className="mt-5 w-full rounded-lg bg-amber-800 px-4 py-3 font-semibold text-white transition-colors hover:bg-amber-900"
                  >
                    Complete Application
                  </button>
                </div>
              </div>
            </div>
          ) : stripePromise && readiness.data?.status === 'READY' ? (
            <Elements stripe={stripePromise}>
              <PaymentForm
                referenceNumber={referenceNumber!}
                amount={amount}
                visaType={app.visaType || 'Tourist Visa'}
                applicantName={applicantName}
                onConfirmed={() => setConfirmed(true)}
              />
            </Elements>
          ) : (
            <div role="alert" className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
              Stripe TEST payments are not configured for this environment.
            </div>
          )}
        </div>

        {/* Support */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Need help? Contact us:</p>
          <p className="mt-1">
            <a href="https://wa.me/971589896644" className="text-[#C9A04C] hover:underline">WhatsApp</a>
            {' | '}
            <a href="tel:+971502101784" className="text-[#C9A04C] hover:underline">+971 50 210 1784</a>
            {' | '}
            <a href="mailto:admin@tashiraev.com" className="text-[#C9A04C] hover:underline">admin@tashiraev.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
