export function verifiedPaymentConversionParameters(
  config: { conversionId: string; purchaseLabel: string },
  input: { transactionId: string; value: number; currency: string },
) {
  if (!/^AW-[A-Z0-9]+$/.test(config.conversionId) || !config.purchaseLabel || !input.transactionId || !Number.isFinite(input.value) || input.value <= 0) {
    return null;
  }
  return {
    send_to: `${config.conversionId}/${config.purchaseLabel}`,
    transaction_id: input.transactionId,
    value: input.value,
    currency: input.currency.toUpperCase(),
  };
}
