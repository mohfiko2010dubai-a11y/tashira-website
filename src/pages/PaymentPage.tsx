import { useState, useEffect, useMemo, useRef } from 'react';
import { usePaymentRecovery } from '@/hooks/usePaymentRecovery';
import { resumeCardPayment } from '@/lib/resume-card-payment';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/providers/trpc-client';
import { loadStripe } from '@stripe/stripe-js/pure';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  CreditCard, Lock, AlertCircle, Loader2,
  Shield, Clock, FileText
} from 'lucide-react';
import { safeStripeFailureCategory, usePaymentTimeline } from '@/hooks/usePaymentTimeline';
import { paymentViewState } from '@/lib/payment-view-state';
import { resolvePaymentDisplayAmount } from '@/lib/payment-display-amount';
import { PaymentSuccessExperience } from '@/components/shared/PaymentSuccessExperience';
import { completionPanelGroups, safeCheckoutErrorMessage } from '@/lib/checkout-preflight';
import { trackFunnelEventOnce, trackVerifiedPaymentConversion } from '@/lib/google-conversion';
import { validatedStripePublishableKey } from '@/lib/stripe-client-config';
import { PayerAuthorizationFields } from '@/components/shared/PayerAuthorizationFields';
import WizardShell, { StepHeader } from '@/components/customer/WizardShell';
import { PolicyAcceptance } from '@/components/customer/PolicyAcceptance';
import { SaveContinueButton } from '@/components/customer/SaveContinueButton';
import { TERMS_POLICY_VERSION } from '@contracts/constants';
import {
  PAYER_AUTHORIZATION_VERSION,
  isThirdPartyPayer,
  payerRelationshipForCheckout,
  type ThirdPartyPayerRelationship,
} from '@contracts/payer-authorization';

const stripePublishableKey = validatedStripePublishableKey(
  import.meta.env.STRIPE_MODE,
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
);

function PaymentForm({ referenceNumber, amount, quoteId, applicantName, policiesAccepted, onConfirmed }: {
  referenceNumber: string;
  amount: number;
  quoteId: string;
  visaType: string;
  applicantName: string;
  policiesAccepted: boolean;
  onConfirmed: () => void;
}) {
  const { t } = useTranslation('wizard');
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [payerName, setPayerName] = useState(applicantName);
  const [payerRelationship, setPayerRelationship] = useState<ThirdPartyPayerRelationship | ''>('');
  const [payerAuthorizationAccepted, setPayerAuthorizationAccepted] = useState(false);
  const utils = trpc.useUtils();
  const paymentTimeline = usePaymentTimeline(referenceNumber);
  const { paymentElementLoaded } = paymentTimeline;

  const confirmPayment = trpc.payment.confirm.useMutation();
  const createIntent = trpc.payment.createIntent.useMutation();

  useEffect(() => {
    if (stripe && elements) paymentElementLoaded();
  }, [elements, paymentElementLoaded, stripe]);

  useEffect(() => {
    trackFunnelEventOnce('begin_checkout', referenceNumber, { value: amount, currency: 'USD' });
  }, [amount, referenceNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting.current) return;
    // Policies gate: payment cannot proceed without ticking the box above.
    if (!policiesAccepted) {
      setError(t('policies.required'));
      return;
    }
    const thirdParty = isThirdPartyPayer(payerName, applicantName);
    if (!payerAuthorizationAccepted) {
      setError('Please confirm that you are authorized to use this payment method.');
      return;
    }
    if (thirdParty && !payerRelationship) {
      setError("Please select the payer's relationship to the applicant.");
      return;
    }
    const selectedPayerRelationship = payerRelationshipForCheckout(payerName, applicantName, payerRelationship);

    submitting.current = true;
    setLoading(true);
    setError('');
    paymentTimeline.paymentStarted();

    try {
      // Convert amount from dollars to cents for Stripe
      const amountInCents = Math.round(amount * 100);

      // Create payment intent via tRPC
      const result = await createIntent.mutateAsync({
        referenceNumber,
        displayedQuoteId: quoteId,
        amount: amountInCents,
        currency: 'usd',
        payerName,
        payerRelationship: selectedPayerRelationship,
        payerAuthorizationAccepted: true,
        payerAuthorizationVersion: PAYER_AUTHORIZATION_VERSION,
      });

      const clientSecret = result.clientSecret;
      if (!clientSecret) {
        throw new Error('Failed to initialize payment');
      }

      const { error: stripeError, paymentIntent } = await resumeCardPayment(stripe, { ...result, clientSecret }, elements.getElement(CardElement)!, payerName);

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
          paymentStatus: 'succeeded',
          transactionId: confirmedPayment.stripePaymentIntentId,
          value: confirmedPayment.totalAmount,
          currency: confirmedPayment.currency,
        });
        await utils.application.getByReference.invalidate({ referenceNumber });
        onConfirmed();
      }
      await utils.payment.status.invalidate({ referenceNumber });
    } catch (err: unknown) {
      paymentTimeline.paymentFailed("unknown");
      setError(safeCheckoutErrorMessage(err));
      await utils.payment.quote.invalidate({ referenceNumber });
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[#1A2332] mb-2">
          <CreditCard size={16} className="inline me-2" />
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

      <PayerAuthorizationFields
        leadApplicantName={applicantName}
        payerName={payerName}
        onPayerNameChange={setPayerName}
        relationship={payerRelationship}
        onRelationshipChange={setPayerRelationship}
        accepted={payerAuthorizationAccepted}
        onAcceptedChange={setPayerAuthorizationAccepted}
      />

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Shield size={16} className="text-emerald-500" />
        <span>Secure payment powered by Stripe</span>
        <Lock size={14} />
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className={`w-full py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
          policiesAccepted
            ? 'bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white hover:shadow-lg'
            : 'bg-gray-200 text-gray-500'
        } disabled:opacity-50`}
      >
        {loading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock size={18} />
            {policiesAccepted ? t('step3.payNow', { amount: amount || 0 }) : t('policies.required')}
          </>
        )}
      </button>
    </form>
  );
}

export default function PaymentPage() {
  const { referenceNumber } = useParams<{ referenceNumber: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('wizard');
  const [confirmed, setConfirmed] = useState(false);
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const acceptPolicies = trpc.payment.acceptPolicies.useMutation();

  // Get application details
  const { data: app, isLoading, error } = trpc.application.getByReference.useQuery(
    { referenceNumber: referenceNumber! },
    { enabled: !!referenceNumber, staleTime: 0, refetchOnMount: 'always' }
  );
  const recovery = usePaymentRecovery(referenceNumber || '', !!app && app.paymentStatus !== 'paid');
  const readiness = trpc.payment.readiness.useQuery(
    { referenceNumber: referenceNumber! },
    { enabled: !!referenceNumber && !!app },
  );
  const price = trpc.payment.quote.useQuery({ referenceNumber: referenceNumber! }, { enabled: !!referenceNumber && !!app, staleTime: 0 });
  const stripePromise = useMemo(
    () => readiness.data?.status === 'READY' && stripePublishableKey
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

  if (isLoading || (!!app && (readiness.isLoading || price.isLoading))) {
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

  // Authoritative amount comes only from the server-side price snapshot.
  // Never fall back to hard-coded client prices: if the snapshot is missing
  // we fail closed instead of displaying an amount that can disagree with
  // the amount Stripe will actually charge.
  const { amount, priceSnapshotMissing } = resolvePaymentDisplayAmount({ totalAmountUsd: price.data ? String(price.data.amount) : null });
  const applicantName = app.applicants.find((applicant) => Number(applicant.applicantIndex) === 0)?.fullName || 'Applicant';
  const completionGroups = readiness.data?.status === 'INCOMPLETE'
    ? completionPanelGroups(readiness.data)
    : [];

  const continueApplication = () => {
    navigate(`/apply/${encodeURIComponent(referenceNumber!)}/interview`);
  };

  const viewState = paymentViewState({ paymentStatus: app.paymentStatus, browserConfirmed: confirmed || recovery.recovered, confirmationPending: recovery.pending });
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

  if (viewState === 'confirming' || recovery.error) return (
    <WizardShell currentStep={3}>
      <div role="status" aria-live="polite" className="rounded-xl border p-6 space-y-4">
        <p>{recovery.error ? 'We could not verify your payment yet. Check its status before trying to pay again.' : 'Checking your existing payment. Please wait for confirmation.'}</p>
        <button type="button" onClick={recovery.retry} className="rounded-lg border px-4 py-2">Check payment status</button>
      </div>
    </WizardShell>
  );

  return (
    <WizardShell currentStep={3}>
      <StepHeader step={3} title={t('step3.title')} subtitle={t('step3.subtitle')} />

      {/* Review summary — everything on screen before payment */}
      <div className="bg-[#FAFAF7] rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#1A2332] mb-4">{t('step3.summary')}</h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('step3.reference')}</span>
            <span className="font-mono font-medium">{referenceNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('step3.applicant')}</span>
            <span className="font-medium">{applicantName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('step3.visaType')}</span>
            <span className="font-medium">{app.visaType}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('step3.processing')}</span>
            <span className="font-medium">{app.processingType}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('step3.applicants')}</span>
            <span className="font-medium">{app.applicants.length || 1}</span>
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between">
            <span className="font-semibold text-[#1A2332]">{t('step3.total')}</span>
            {priceSnapshotMissing ? (
              <span className="text-sm font-medium text-red-500">Unavailable</span>
            ) : (
              <span className="text-2xl font-bold text-[#C9A04C]">${amount}</span>
            )}
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

      {/* Policies acceptance — mandatory before payment */}
      <div className="mb-6">
        <PolicyAcceptance accepted={policiesAccepted} onChange={value => {
          if (!value) { setPoliciesAccepted(false); return; }
          if (acceptPolicies.isPending) return;
          acceptPolicies.mutate({ referenceNumber: referenceNumber!, accepted: true, policyVersion: TERMS_POLICY_VERSION }, {
            onSuccess: () => { setPoliciesAccepted(true); void readiness.refetch(); },
          });
        }} />
        {acceptPolicies.isPending && <p role="status">{t('simple.saving')}</p>}
        {acceptPolicies.isError && <p role="alert">{t('simple.error')}</p>}
      </div>

      {/* Payment Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {priceSnapshotMissing ? (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            <p>{price.error?.message ?? 'The current price is unavailable. Refresh the price or contact support before paying.'}</p>
            <button type="button" onClick={() => void price.refetch()} className="mt-2 underline">Refresh price</button>
          </div>
        ) : readiness.error ? (
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
                      <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-amber-800">
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
              quoteId={price.data?.quoteId ?? ''}
              visaType={app.visaType || 'Tourist Visa'}
              applicantName={applicantName}
              policiesAccepted={policiesAccepted}
              onConfirmed={() => setConfirmed(true)}
            />
          </Elements>
        ) : (
          <div role="alert" className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
            Stripe payments are not configured correctly.
          </div>
        )}
      </div>

      {/* Save & continue via email */}
      <div className="mt-6 flex justify-center">
        <SaveContinueButton email={(app as { contactEmail?: string }).contactEmail} />
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
    </WizardShell>
  );
}

