/** Explicit USD wording avoids bidi reordering of the US$ suffix in Arabic. */
export function customerMoney(amount: number, language: string, currency = "USD"): string {
  if (language.startsWith("ar") && currency.toUpperCase() === "USD") {
    return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} دولار`;
  }
  return new Intl.NumberFormat(language, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}
