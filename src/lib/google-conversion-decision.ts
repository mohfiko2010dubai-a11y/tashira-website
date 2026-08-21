export const GA4_MEASUREMENT_ID = "G-650XVXCSYB";

export type VerifiedPurchaseInput = {
  paymentStatus: "succeeded" | "failed" | "requires_action";
  transactionId: string;
  value: number;
  currency: string;
};

export type AnalyticsStorage = Pick<Storage, "getItem" | "setItem">;

export function claimAnalyticsEvent(storage: AnalyticsStorage, key: string) {
  if (storage.getItem(key) === "sent") return false;
  storage.setItem(key, "sent");
  return true;
}

export function safeFunnelParameters(
  eventName: "begin_application" | "application_submitted" | "begin_checkout",
  parameters: Record<string, string | number>,
) {
  const allowed = eventName === "begin_checkout"
    ? { value: parameters.value, currency: parameters.currency }
    : eventName === "application_submitted"
      ? { applicant_count: parameters.applicant_count, application_type: parameters.application_type }
      : {};
  return Object.fromEntries(Object.entries(allowed).filter((entry): entry is [string, string | number] => (
    typeof entry[1] === "string" || typeof entry[1] === "number"
  )));
}

export function verifiedPaymentConversionParameters(input: VerifiedPurchaseInput) {
  if (
    input.paymentStatus !== "succeeded"
    || !/^pi_[A-Za-z0-9_]+$/.test(input.transactionId)
    || !Number.isFinite(input.value)
    || input.value <= 0
    || !/^[A-Za-z]{3}$/.test(input.currency)
  ) return null;

  return {
    transaction_id: input.transactionId,
    value: input.value,
    currency: input.currency.toUpperCase(),
  };
}
