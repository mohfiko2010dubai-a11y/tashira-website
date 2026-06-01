import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { trpc } from '@/providers/trpc';
import { CreditCard, Lock, CheckCircle } from 'lucide-react';

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

function PaymentFormInner({
  amount,
  referenceNumber,
  onSuccess,
  onClose,
}: {
  amount: number;
  referenceNumber: string;
  onSuccess: (invoiceNumber: string) => void;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createIntent = trpc.payment.createIntent.useMutation();
  const confirmPayment = trpc.payment.confirm.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');

    try {
      // 1. Create payment intent
      const { clientSecret, error: intentError } = createIntent.mutateSync({
        amount: amount * 100, // cents
        currency: 'usd',
        referenceNumber,
      });

      if (intentError || !clientSecret) {
        throw new Error(intentError || 'Failed to create payment intent');
      }

      // 2. Confirm card payment
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
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
        // 3. Confirm on backend
        const result = confirmPayment.mutateSync({
          referenceNumber,
          paymentIntentId: paymentIntent.id,
        });

        if (result.success) {
          onSuccess(result.invoiceNumber || '');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Amount display */}
      <div className="bg-gradient-to-r from-[#C9A04C]/10 to-[#C9A04C]/5 border border-[#C9A04C]/20 rounded-xl p-4 text-center">
        <p className="text-sm text-gray-500 mb-1">Total Amount</p>
        <p className="text-3xl font-bold text-[#C9A04C]">${amount}</p>
        <p className="text-xs text-gray-400 mt-1">Ref: {referenceNumber}</p>
      </div>

      {/* Card input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <CreditCard size={14} className="text-[#C9A04C]" />
          Card Details
        </label>
        <div className="border border-gray-200 rounded-lg p-3 focus-within:border-[#C9A04C] focus-within:ring-1 focus-within:ring-[#C9A04C] transition-all">
          <CardElement options={{ style: cardStyle.style }} />
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Lock size={12} className="text-emerald-500" />
        <span>Secured by Stripe. Your card details are never stored on our servers.</span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
        >
          {loading ? 'Processing...' : `Pay $${amount}`}
        </button>
      </div>
    </form>
  );
}

export default function StripePaymentForm({
  amount,
  referenceNumber,
  onSuccess,
  onClose,
}: {
  amount: number;
  referenceNumber: string;
  onSuccess: (invoiceNumber: string) => void;
  onClose: () => void;
}) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormInner
        amount={amount}
        referenceNumber={referenceNumber}
        onSuccess={onSuccess}
        onClose={onClose}
      />
    </Elements>
  );
}

// Success modal after payment
export function PaymentSuccessModal({
  invoiceNumber,
  referenceNumber,
  onClose,
}: {
  invoiceNumber: string;
  referenceNumber: string;
  onClose: () => void;
}) {
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
      </div>
      <button
        onClick={onClose}
        className="w-full px-4 py-3 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white rounded-lg font-semibold hover:shadow-lg transition-all"
      >
        Done
      </button>
    </div>
  );
}
