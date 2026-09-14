import { useEffect, useRef } from 'react';
import { trpc } from '@/providers/trpc-client';

/** Reconcile an interrupted confirmation with Stripe before offering another payment. */
export function usePaymentRecovery(referenceNumber: string, enabled = true) {
  const utils = trpc.useUtils();
  const confirm = trpc.payment.confirm.useMutation();
  const attempted = useRef<string | null>(null);
  const status = trpc.payment.status.useQuery({ referenceNumber }, {
    enabled: enabled && !!referenceNumber,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: query => query.state.data?.status === 'processing' ? 3000 : false,
    retry: 1,
  });
  const { mutate } = confirm;
  useEffect(() => {
    const intentId = status.data?.paymentIntentId;
    if (status.data?.status !== 'succeeded' || !intentId || attempted.current === intentId) return;
    attempted.current = intentId;
    mutate({ referenceNumber, paymentIntentId: intentId }, { onSuccess: () => {
      void utils.application.getByReference.invalidate({ referenceNumber });
      void utils.payment.readiness.invalidate({ referenceNumber });
      void utils.payment.status.invalidate({ referenceNumber });
    } });
  }, [confirm.status, mutate, referenceNumber, status.data, utils]);
  return {
    recovered: status.data?.status === 'paid' || !!confirm.data,
    pending: enabled && (status.isLoading || status.data?.status === 'processing' || status.data?.status === 'succeeded'),
    error: status.error || confirm.error,
    retry: () => { attempted.current = null; confirm.reset(); void status.refetch(); },
    refresh: () => utils.payment.status.invalidate({ referenceNumber }),
  };
}
