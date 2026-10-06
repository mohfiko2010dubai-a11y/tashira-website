/** USD amounts are compared in minor units, never browser totals. */
export function visaChangeAmount(oldTotal: number, newTotal: number, oldCurrency: string, newCurrency: string) {
  if (oldCurrency.toUpperCase() !== "USD" || newCurrency.toUpperCase() !== "USD") throw new Error("Visa changes require matching USD quotes");
  const minor = (value: number) => {
    const result = Math.round(value * 100);
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(result) || Math.abs(value * 100 - result) > 0.000001) {
      throw new Error("Invalid visa-change monetary amount");
    }
    return result;
  };
  const oldTotalMinor = minor(oldTotal), newTotalMinor = minor(newTotal);
  const differenceMinor = newTotalMinor - oldTotalMinor;
  return { oldTotalMinor, newTotalMinor, differenceMinor, currency: "USD" as const,
    direction: differenceMinor > 0 ? "PAY" as const : differenceMinor < 0 ? "REFUND" as const : "NONE" as const };
}
