/**
 * Authoritative payment display amount.
 *
 * The amount shown to the customer must always come from the server-side
 * price snapshot stored on the application (USD preferred, AED converted).
 * Hard-coded client-side price fallbacks are forbidden: if the snapshot is
 * missing the caller must fail closed (block payment) instead of displaying
 * an amount that can disagree with what Stripe will actually charge.
 */
export interface PaymentDisplayAmount {
  /** Amount in USD, or 0 when no authoritative price snapshot exists. */
  amount: number;
  /** True when the application has no usable server-side price snapshot. */
  priceSnapshotMissing: boolean;
}

const AED_PER_USD = 3.67;

export function resolvePaymentDisplayAmount(app: {
  totalAmountUsd?: string | number | null;
  totalAmountAed?: string | number | null;
}): PaymentDisplayAmount {
  const usd = typeof app.totalAmountUsd === "string"
    ? Number.parseFloat(app.totalAmountUsd)
    : typeof app.totalAmountUsd === "number"
      ? app.totalAmountUsd
      : Number.NaN;
  const aed = typeof app.totalAmountAed === "string"
    ? Number.parseFloat(app.totalAmountAed)
    : typeof app.totalAmountAed === "number"
      ? app.totalAmountAed
      : Number.NaN;

  if (Number.isFinite(usd) && usd > 0) {
    return { amount: usd, priceSnapshotMissing: false };
  }
  if (Number.isFinite(aed) && aed > 0) {
    return { amount: aed / AED_PER_USD, priceSnapshotMissing: false };
  }
  return { amount: 0, priceSnapshotMissing: true };
}
